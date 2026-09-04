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
