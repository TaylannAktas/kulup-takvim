import { toClubTime } from "./date-utils";

/**
 * Bugüne göre içinde bulunulan akademik yılı döner (örn. "2026-2027").
 * Akademik yıl Ağustos ayında başlar kabul edilir (güz dönemi kayıtları
 * genelde Temmuz/Ağustos'ta yayınlanıyor — bkz. fixtures/academic-calendar).
 */
export function currentAcademicYear(reference: Date = new Date()): string {
  const clubNow = toClubTime(reference);
  const year = clubNow.getFullYear();
  const month = clubNow.getMonth() + 1; // 1-12
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
