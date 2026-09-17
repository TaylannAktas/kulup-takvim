import type { CalendarBarItem } from "./month-events";

export type WeekBarLane = {
  bar: CalendarBarItem;
  /** 0-6 (Pazartesi=0), bu haftaya kırpılmış başlangıç/bitiş sütunu. */
  startCol: number;
  endCol: number;
  lane: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Küçük sayı önce yerleşir: kulüp etkinliği → sınav → akademik → ders. */
function kindPriority(bar: CalendarBarItem): number {
  if (bar.kind.startsWith("club_event")) return 0;
  if (bar.kind.startsWith("exam")) return 1;
  if (bar.kind.startsWith("academic")) return 2;
  return 3;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((toMidnight(b).getTime() - toMidnight(a).getTime()) / MS_PER_DAY);
}

function toMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Verilen bar listesini bir hafta satırına kırpar ve üst üste binmeyen "kulvarlara"
 * (lane) atar — böylece çok günlü kayıtlar hücreler boyunca kesintisiz bir şerit
 * olarak, birden fazla bar aynı günlere denk gelirse alt alta ayrı satırlarda
 * gösterilebilir (spec §6.5 "kesintisiz şerit").
 *
 * Algoritma HourlyTimeline'daki sütun atamasıyla aynı mantık, eksen değişik:
 * zaman yerine hafta içi gün indeksi (0-6) kullanılıyor.
 */
export function assignWeekBarLanes(bars: CalendarBarItem[], weekStart: Date): WeekBarLane[] {
  const weekStartMid = toMidnight(weekStart);
  const weekEndCol = 6;

  const clipped = bars
    .map((bar) => {
      const startCol = Math.max(0, dayDiff(weekStartMid, bar.startDate));
      const endCol = Math.min(weekEndCol, dayDiff(weekStartMid, bar.endDate));
      return { bar, startCol, endCol };
    })
    .filter((entry) => entry.startCol <= entry.endCol && entry.endCol >= 0 && entry.startCol <= weekEndCol);

  // Kulüp etkinlikleri önce yerleşir (kullanıcı isteği, 2026-09-17): eskiden
  // sıralama türe bakmıyordu, yoğun bir günde etkinlik görünür 3 kulvarın
  // dışına, "+N daha"nın içine düşebiliyordu. Öncelik sırası bozulduğu için
  // kulvar doluluğu "son bitiş sütunu" yerine gün gün tutuluyor.
  clipped.sort(
    (a, b) => kindPriority(a.bar) - kindPriority(b.bar) || a.startCol - b.startCol || b.endCol - a.endCol
  );

  const laneOccupied: boolean[][] = [];
  const result: WeekBarLane[] = [];

  for (const entry of clipped) {
    let lane = laneOccupied.findIndex((cols) => cols.slice(entry.startCol, entry.endCol + 1).every((taken) => !taken));
    if (lane === -1) {
      lane = laneOccupied.length;
      laneOccupied.push(Array(7).fill(false));
    }
    for (let col = entry.startCol; col <= entry.endCol; col++) laneOccupied[lane][col] = true;
    result.push({ bar: entry.bar, startCol: entry.startCol, endCol: entry.endCol, lane });
  }

  return result;
}
