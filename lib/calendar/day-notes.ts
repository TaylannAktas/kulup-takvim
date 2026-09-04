import type { dayNotes } from "@/lib/db/schema";

/**
 * Gün notlarının "sadece tarih" alanıyla ilgili dönüşümler.
 *
 * Bu modül route.ts dosyalarından ayrı duruyor: Next.js route dosyalarının
 * yalnızca bilinen dışa aktarımları (GET/POST/... , `dynamic` vb.) olabiliyor,
 * yardımcı fonksiyon export etmek build'i kırıyor.
 */

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "YYYY-MM-DD" → UTC gece yarısı Date.
 *
 * Drizzle `date` sütununa yazarken `value.toISOString()` çağırıyor; yerel gece
 * yarısı bir Date kullanılsaydı UTC+3'te tarih bir gün geriye kayardı
 * ("2025-10-31" → "2025-10-30T21:00Z" → Postgres'te 2025-10-30). UTC gece
 * yarısı bu kaymayı imkânsız kılar.
 */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Sürücüden gelen `date` değeri süreç yerel saatinin gece yarısıdır; takvim
 * günü yerel getter'larla okunur (depodaki mevcut desen, bkz. day-detail.ts).
 */
export function formatDateOnly(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DayNoteRow = typeof dayNotes.$inferSelect;

/** API dışına `date` alanı her zaman "YYYY-MM-DD" olarak verilir, ISO anı olarak değil. */
export function serializeDayNote(row: DayNoteRow) {
  return { ...row, date: formatDateOnly(row.date) };
}
