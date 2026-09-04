import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type UserRow = typeof users.$inferSelect;

/**
 * Başarılı bir girişten sonra users tablosunu günceller.
 *
 * - Kayıt yoksa: yeni satır açılır (rol = ADMIN_EMAILS'te ise admin, değilse editor).
 * - Kayıt varsa: sadece name / lastLoginAt tazelenir. Rol KORUNUR; elle yapılan
 *   rol değişiklikleri her girişte sessizce ezilmez.
 * - ADMIN_EMAILS'te olan bir e-posta her girişte admin'e yükseltilir; böylece
 *   yetki verme işlemi DB'ye elle dokunmadan ortam değişkeniyle yapılabilir.
 */
export async function syncUserOnSignIn(params: {
  email: string;
  name: string | null;
  isAdmin: boolean;
}): Promise<UserRow> {
  const { email, name, isAdmin } = params;
  const now = new Date();

  const [row] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email,
      name,
      role: isAdmin ? "admin" : "editor",
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name, lastLoginAt: now },
    })
    .returning();

  // ADMIN_EMAILS'teki e-postalar her girişte admin'e yükseltilir.
  if (isAdmin && row.role !== "admin") {
    const [promoted] = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.email, email))
      .returning();
    return promoted ?? row;
  }

  return row;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}
