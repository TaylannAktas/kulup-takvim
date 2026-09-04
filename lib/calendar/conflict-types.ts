/**
 * Çakışma türleri — client ve server tarafından kullanılabilir.
 * Hesaplama lojigi server-only dosyadır (conflict-detection.ts).
 */

export type ConflictEntry = {
  /** Çakışan kaydın kendi id'si (exam_sessions / academic_calendar_entries / club_events). */
  id: string;
  /** Kısa etiket — rozet/çip içinde gösterilebilecek uzunlukta. */
  label: string;
  /** İnsan okuyacak Türkçe açıklama parçası. */
  detail: string;
};

export type ConflictFlags = {
  exam: ConflictEntry[];
  holiday: ConflictEntry[];
  event: ConflictEntry[];
};

export function hasAnyConflict(flags: ConflictFlags): boolean {
  return flags.exam.length > 0 || flags.holiday.length > 0 || flags.event.length > 0;
}
