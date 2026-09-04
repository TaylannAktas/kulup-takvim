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

export type Term = "guz" | "bahar" | "yaz";

/**
 * Bir akademik yıl + dönem için YAKLAŞIK tarih aralığı (Dönem ısı haritası
 * varsayılanı için — spesifikasyonun kesin dönem sınırları
 * academic_calendar_entries'teki DERS_DONEMI kayıtlarından çıkarılabilir ama
 * bu, Faz 5 "cila" kapsamı için gereğinden karmaşık; kullanıcı istediğinde
 * from/to'yu elle değiştirebiliyor).
 */
export function termDateRange(sourceYear: string, term: Term): { start: Date; end: Date } {
  const [startYear, endYear] = sourceYear.split("-").map(Number);
  switch (term) {
    case "guz":
      return { start: new Date(startYear, 8, 1), end: new Date(startYear, 11, 31) };
    case "bahar":
      return { start: new Date(endYear, 0, 1), end: new Date(endYear, 4, 31) };
    case "yaz":
      return { start: new Date(endYear, 5, 1), end: new Date(endYear, 7, 31) };
  }
}

/** Bugüne göre en muhtemel dönem (güz/bahar/yaz) — sadece varsayılan seçim için. */
export function currentTerm(reference: Date = new Date()): Term {
  const month = toClubTime(reference).getMonth() + 1;
  if (month >= 9 || month <= 1) return "guz";
  if (month >= 2 && month <= 5) return "bahar";
  return "yaz";
}
