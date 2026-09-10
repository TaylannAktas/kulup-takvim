import { DayCell } from "./DayCell";
import { getMonthGridDays, todayInClubTime } from "@/lib/calendar/date-utils";
import { dominantKind, type CalendarBarItem, type AcademicDayEntry } from "@/lib/calendar/month-events";
import { getEventStyle } from "@/lib/calendar/color-system";
import { assignWeekBarLanes } from "@/lib/calendar/week-bar-layout";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Bir haftada aynı anda en fazla bu kadar bar satırı gösterilir; gerisi "+N daha". */
const MAX_VISIBLE_LANES = 3;

type MonthGridProps = {
  monthAnchor: Date;
  bars?: CalendarBarItem[];
  /** Gün → o günü kapsayan akademik takvim kayıtları (bkz. getMonthCalendarBars). */
  academicDayEntries?: Map<string, AcademicDayEntry[]>;
  /** Notu olan günlerin "YYYY-MM-DD" kümesi — hücrenin sağ üst köşesindeki işaret için. */
  noteDates?: Set<string>;
  /** Isı haritası katmanı açık mı (varsayılan kapalı) — bkz. DayCell. */
  heatmapOn?: boolean;
  /** Verilirse her gün hücresi bu temel URL'e `&day=YYYY-MM-DD` eklenmiş bir bağlantı olur. */
  dayHrefBase?: string;
  selectedDayIso?: string;
  /**
   * Kompakt mini-ay modu (Dönem görünümü, kullanıcı isteği 2026-09-10) —
   * sabit 7-sütun grid (mobil-first `sm:` kısıtı yok), haftalık başlık
   * gizli, bar/lane metin şeritleri hiç render edilmez. Akademik fon/segment,
   * not üçgeni, dominant-tür glyph'i `DayCell` üzerinden KALIR.
   */
  compact?: boolean;
};

function dayIso(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function chunkIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function barCoversDay(bar: CalendarBarItem, day: Date): boolean {
  return bar.startDate <= day && day <= bar.endDate;
}

export function MonthGrid({
  monthAnchor,
  bars = [],
  academicDayEntries,
  noteDates,
  heatmapOn,
  dayHrefBase,
  selectedDayIso,
  compact,
}: MonthGridProps) {
  const days = getMonthGridDays(monthAnchor);
  const today = todayInClubTime();
  const weeks = chunkIntoWeeks(days);

  return (
    <div className="flex h-full flex-col">
      {!compact && (
        <div className="hidden sm:grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              {label}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {weeks.map((week, weekIndex) => {
          const lanes = compact ? [] : assignWeekBarLanes(bars, week[0]);
          const visibleLanes = lanes.filter((l) => l.lane < MAX_VISIBLE_LANES);
          const laneRowCount = compact
            ? 0
            : Math.min(MAX_VISIBLE_LANES, lanes.reduce((max, l) => Math.max(max, l.lane + 1), 0));

          return (
            <div
              key={week[0].toISOString()}
              className={`relative grid flex-1 ${compact ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7"}`}
            >
              {week.map((day, dayInWeekIndex) => {
                // Kompakt modda bar/lane METİN şeritleri hiç render edilmez ama
                // dominant tür (küçük glyph + zemin tonu) DayCell'te kalmaya
                // devam ettiği için kapsayan bar'lar burada da hesaplanmalı.
                const coveringBars = bars.filter((bar) => barCoversDay(bar, day));
                const visibleCoveringCount = compact
                  ? 0
                  : visibleLanes.filter((l) => barCoversDay(l.bar, day)).length;
                const overflow = coveringBars.length - visibleCoveringCount;
                const iso = dayIso(day);
                const flatDayIndex = weekIndex * 7 + dayInWeekIndex;
                return (
                  <DayCell
                    key={day.toISOString()}
                    day={day}
                    monthAnchor={monthAnchor}
                    today={today}
                    dominantKind={dominantKind(coveringBars.map((b) => b.kind))}
                    overflowCount={compact ? 0 : Math.max(0, overflow)}
                    hasNote={noteDates?.has(iso) ?? false}
                    academicDayEntries={academicDayEntries?.get(iso)}
                    heatmapOn={heatmapOn}
                    href={dayHrefBase ? `${dayHrefBase}&day=${iso}` : undefined}
                    selected={selectedDayIso === iso}
                    dayIndex={flatDayIndex}
                    compact={compact}
                  />
                );
              })}
              {!compact && laneRowCount > 0 && (
                <div
                  className="pointer-events-none hidden sm:grid absolute left-0 right-0 top-6 grid-cols-7 gap-y-0.5 px-1"
                  style={{ gridTemplateRows: `repeat(${laneRowCount}, minmax(0, 1.1rem))` }}
                >
                  {visibleLanes.map(({ bar, startCol, endCol, lane }) => {
                    const style = getEventStyle(bar.kind);
                    // Ders oturumları her zaman tek günlük — "kesintisiz şerit"
                    // anlamı taşımıyorlar (o, çok günlü akademik takvim/etkinlik
                    // kayıtları için). Hücreyi tam doldurup uzun bir çizgi gibi
                    // durmasınlar diye (kullanıcı isteği, 2026-09-07) sabit dar
                    // genişlikte, sola yaslı bir "rozet" olarak gösteriliyorlar.
                    const isCourseBar = bar.kind === "course_session" || bar.kind === "course_session_lab";
                    return (
                      <div
                        key={bar.id}
                        className={`pointer-events-auto truncate rounded px-1 text-[10px] leading-[1.1rem] ${style.barClassName} ${
                          isCourseBar ? "w-16 justify-self-start" : ""
                        }`}
                        style={{
                          gridColumnStart: startCol + 1,
                          gridColumnEnd: endCol + 2,
                          gridRow: lane + 1,
                        }}
                        title={`${style.label}: ${bar.label}${bar.hasConflict ? " — çakışma var" : ""}`}
                      >
                        <span className="mr-0.5">{style.icon}</span>
                        {bar.label}
                        {bar.hasConflict && <span className="ml-0.5 font-bold text-red-600">!</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
