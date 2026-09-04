import Link from "next/link";

/**
 * Auth.js v5 hata sayfası. Reddedilen girişte @auth/core
 * `/error?error=AccessDenied` adresine yönlendirir.
 */
const MESSAGES: Record<string, string> = {
  AccessDenied: "Bu e-posta adresi bu uygulamaya erişim için yetkili değil.",
  Configuration:
    "Giriş yapılandırmasında bir sorun var. Lütfen yöneticiyle iletişime geçin.",
  Verification: "Doğrulama bağlantısı geçersiz veya süresi dolmuş.",
};

export default async function AuthErrorPage({ searchParams }: PageProps<"/error">) {
  const params = await searchParams;
  const code = typeof params.error === "string" ? params.error : "";
  const message = MESSAGES[code] ?? "Giriş sırasında bir hata oluştu.";

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-xl font-semibold">Giriş yapılamadı</h1>
        <p className="text-sm text-gray-600">{message}</p>
        <Link href="/signin" className="text-sm underline">
          Giriş sayfasına dön
        </Link>
      </div>
    </main>
  );
}
