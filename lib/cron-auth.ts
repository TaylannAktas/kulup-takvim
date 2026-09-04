import "server-only";
import { NextRequest } from "next/server";

/**
 * Cron uç noktalarını session'dan bağımsız korur (spesifikasyon §8.3).
 * proxy.ts bu yolları zaten muaf tutuyor; asıl doğrulama burada yapılır.
 */
export function isValidCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
