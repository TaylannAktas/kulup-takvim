/**
 * ALLOWED_EMAILS / ADMIN_EMAILS ortam değişkenlerini okuyan saf yardımcılar.
 *
 * Ortam değişkenleri modül yüklenirken değil, çağrı anında okunur; böylece
 * build sırasında boş/placeholder değerler sorun çıkarmaz.
 */

function parseEmailList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** ALLOWED_EMAILS listesinde ise true. Liste boşsa hiç kimse giremez (fail-closed). */
export function isAllowedEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return parseEmailList(process.env.ALLOWED_EMAILS).includes(normalized);
}

/** ADMIN_EMAILS listesinde ise true. */
export function isAdminEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return parseEmailList(process.env.ADMIN_EMAILS).includes(normalized);
}
