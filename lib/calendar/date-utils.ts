import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth as isSameMonthFns,
  isSameDay as isSameDayFns,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { tr } from "date-fns/locale";

/**
 * Tüm takvim hesapları bu saat dilimine göre yapılır. Veritabanı UTC saklar,
 * ama "gün" sınırları her zaman Europe/Istanbul'a göre belirlenir — sunucu UTC
 * çalışsa bile (Vercel).
 */
export const CLUB_TIMEZONE = "Europe/Istanbul";

/** Bir UTC anını, Europe/Istanbul'daki takvim gününe/saatine karşılık gelen bir Date'e çevirir. */
export function toClubTime(utcDate: Date): Date {
  return toZonedTime(utcDate, CLUB_TIMEZONE);
}

/** Europe/Istanbul'da "duvar saati" olarak ifade edilmiş bir Date'i, karşılık gelen UTC anına çevirir. */
export function fromClubTime(wallTime: Date): Date {
  return fromZonedTime(wallTime, CLUB_TIMEZONE);
}

/** Bugünün tarihini Europe/Istanbul takvim gününe göre döner (saat 00:00, o dilimde). */
export function todayInClubTime(): Date {
  const now = toClubTime(new Date());
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Bir ayın takvim ızgarası için gösterilecek günleri döner: haftanın Pazartesi
 * başlangıçlı olacak şekilde, ayın ilk haftasının başından son haftasının sonuna kadar.
 */
export function getMonthGridDays(monthAnchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function isSameMonth(a: Date, b: Date): boolean {
  return isSameMonthFns(a, b);
}

export function isSameDay(a: Date, b: Date): boolean {
  return isSameDayFns(a, b);
}

export function nextMonth(monthAnchor: Date): Date {
  return addMonths(monthAnchor, 1);
}

export function previousMonth(monthAnchor: Date): Date {
  return subMonths(monthAnchor, 1);
}

/** Ay başlığı için "Eylül 2026" gibi Türkçe biçim. */
export function formatMonthTitle(monthAnchor: Date): string {
  return format(monthAnchor, "LLLL yyyy", { locale: tr });
}

export function formatDayNumber(day: Date): string {
  return format(day, "d");
}

export function isWeekend(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

/** Dönem görünümünün sabit bitiş noktası — kullanıcının verdiği sabit tarih (2026-09-08). */
const TERM_RANGE_END_YEAR = 2027;
const TERM_RANGE_END_MONTH_INDEX = 6; // 0-tabanlı: 6 = Temmuz

/**
 * "Dönem" olarak gösterilen ay listesi: verilen günün ayından sabit bitişe
 * (Temmuz 2027) kadar, her ayın ilk günü. Hem kompakt Dönem görünümü
 * (`app/calendar/term/page.tsx`) hem Ay görünümünün "Tam ekran" modu
 * (`app/calendar/page.tsx`) aynı aralığı kullanır.
 */
export function getTermMonthAnchors(today: Date): Date[] {
  const startAnchor = new Date(today.getFullYear(), today.getMonth(), 1);
  const endAnchor = new Date(TERM_RANGE_END_YEAR, TERM_RANGE_END_MONTH_INDEX, 1);

  const anchors: Date[] = [];
  for (
    let anchor = new Date(startAnchor);
    anchor <= endAnchor;
    anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  ) {
    anchors.push(anchor);
  }
  return anchors;
}
