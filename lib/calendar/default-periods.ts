import type { TimelinePeriod } from "@/components/calendar/HourlyTimeline";

/**
 * Atılım Üniversitesi'nin sabit ders saati düzeni — kullanıcı isteğiyle koda
 * gömüldü (2026-09-07). Gerçek `timetable_imports.periods` verisi öncelikli
 * kalır (bkz. `getDayDetail`); bu sadece o veri yokken (henüz bu özellikten
 * önce yüklenmiş bir içe aktarma, ya da hiç ders programı katmanı seçili
 * değilken) çizelgenin yine de "okulun sitesindeki gibi" bölünmüş
 * görünmesini sağlayan bir yedek.
 *
 * Kaynak: gerçek bir edupage sayfasından `extractPeriods` ile çıkarılmış
 * değerler (bkz. DECISIONS.md 2026-09-07, "Gün ayrıntı çizelgesi... period
 * sınırlarına bölündü") — 09:30'dan başlayarak her biri 50 dk ders + 10 dk
 * ara. Okul bu düzeni değiştirirse burada elle güncellenmesi gerekir.
 */
export const DEFAULT_PERIODS: TimelinePeriod[] = [
  { startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 + 20, label: "9:30 - 10:20" },
  { startMinutes: 10 * 60 + 30, endMinutes: 11 * 60 + 20, label: "10:30 - 11:20" },
  { startMinutes: 11 * 60 + 30, endMinutes: 12 * 60 + 20, label: "11:30 - 12:20" },
  { startMinutes: 12 * 60 + 30, endMinutes: 13 * 60 + 20, label: "12:30 - 13:20" },
  { startMinutes: 13 * 60 + 30, endMinutes: 14 * 60 + 20, label: "13:30 - 14:20" },
  { startMinutes: 14 * 60 + 30, endMinutes: 15 * 60 + 20, label: "14:30 - 15:20" },
  { startMinutes: 15 * 60 + 30, endMinutes: 16 * 60 + 20, label: "15:30 - 16:20" },
  { startMinutes: 16 * 60 + 30, endMinutes: 17 * 60 + 20, label: "16:30 - 17:20" },
  { startMinutes: 17 * 60 + 30, endMinutes: 18 * 60 + 20, label: "17:30 - 18:20" },
  { startMinutes: 18 * 60 + 30, endMinutes: 19 * 60 + 20, label: "18:30 - 19:20" },
  { startMinutes: 19 * 60 + 30, endMinutes: 20 * 60 + 20, label: "19:30 - 20:20" },
  { startMinutes: 20 * 60 + 30, endMinutes: 21 * 60 + 20, label: "20:30 - 21:20" },
];
