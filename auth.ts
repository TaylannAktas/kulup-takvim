import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAdminEmail, isAllowedEmail, normalizeEmail } from "@/lib/auth/allowlist";

/**
 * Auth.js v5 (next-auth 5.0.0-beta.32) yapılandırması.
 *
 * - Sadece Google sağlayıcısı. AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, @auth/core
 *   tarafından provider id'sinden (google) otomatik okunur; burada tekrar
 *   yazmıyoruz ki build sırasında modül seviyesinde env okuması olmasın.
 * - DB adapter YOK: JWT session stratejisi + elle yazılan users upsert'i.
 * - lib/db modül yüklenirken DATABASE_URL zorunlu kıldığı için DB'ye dokunan
 *   kod dinamik import ile, sadece istek anında yükleniyor. Böylece build ve
 *   proxy başlangıcı DB env'ine bağımlı olmuyor.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
    error: "/error",
  },
  callbacks: {
    /**
     * Allowlist kapısı. Listede olmayan e-posta için hiçbir DB yazımı yapılmaz
     * ve false döndürülür -> Auth.js session/kayıt oluşturmaz, kullanıcıyı
     * /error?error=AccessDenied adresine yönlendirir.
     */
    async signIn({ user, profile }) {
      const email = normalizeEmail(profile?.email ?? user?.email);
      if (!email) return false;

      // Google doğrulanmamış e-posta bildirirse kabul etme.
      if (profile && profile.email_verified === false) return false;

      if (!isAllowedEmail(email)) return false;

      const { syncUserOnSignIn } = await import("@/lib/auth/sync-user");
      await syncUserOnSignIn({
        email,
        name: profile?.name ?? user?.name ?? null,
        isAdmin: isAdminEmail(email),
      });

      return true;
    },

    /**
     * İlk girişte (user/account mevcutken) DB satırını okuyup id ve role'ü
     * token'a gömer. Sonraki isteklerde token olduğu gibi kullanılır; her
     * istekte DB'ye gidilmez.
     */
    async jwt({ token, user }) {
      if (user) {
        const email = normalizeEmail(user.email ?? token.email);
        const { getUserByEmail } = await import("@/lib/auth/sync-user");
        const row = email ? await getUserByEmail(email) : null;

        // signIn callback'i başarılı olduysa satır kesinlikle vardır.
        // Yoksa fail-closed davran: token'ı tamamlamak yerine hata fırlat.
        if (!row) {
          throw new Error("Giriş yapan kullanıcı veritabanında bulunamadı.");
        }

        token.id = row.id;
        token.role = row.role;
        token.email = row.email;
      }
      return token;
    },

    /** id ve role'ü istemciye/sunucu bileşenlerine açar. */
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id;
        if (token.role) session.user.role = token.role;
      }
      return session;
    },
  },
});
