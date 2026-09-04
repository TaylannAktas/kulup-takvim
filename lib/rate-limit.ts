import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitResult = { allowed: boolean; retryAfterMs?: number };

/**
 * Basit sabit-pencereli (fixed-window) oran sınırlama, tek satır üzerinde.
 * 3 kullanıcılık bir uygulamada eşzamanlı yarış koşulu pratikte önemsiz;
 * Redis/Upstash gibi bir bağımlılık eklemeye değmiyor (bkz. plan dosyası).
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();

  const [existing] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMs) {
    await db
      .insert(rateLimits)
      .values({ key, windowStart: now, count: 1 })
      .onConflictDoUpdate({ target: rateLimits.key, set: { windowStart: now, count: 1 } });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    const retryAfterMs = windowMs - (now.getTime() - existing.windowStart.getTime());
    return { allowed: false, retryAfterMs };
  }

  await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1` })
    .where(eq(rateLimits.key, key));

  return { allowed: true };
}
