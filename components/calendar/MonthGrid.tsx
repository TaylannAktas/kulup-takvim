import { DayCell } from "./DayCell";
import { getMonthGridDays, todayInClubTime } from "@/lib/calendar/date-utils";
import { dominantKind, type CalendarBarItem } from "@/lib/calendar/month-events";
import { getEventStyle } from "@/lib/calendar/color-system";
import { assignWeekBarLanes } from "@/lib/calendar/week-bar-layout";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Bir haftada aynı anda en fazla bu kadar bar satırı gösterilir; gerisi "+N daha". */
const MAX_VISIBLE_LANES = 3;

type MonthGridProps = {
  monthAnchor: Date;
  bars?: CalendarBarItem[];
};

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

export function MonthGrid({ monthAnchor, bars = [] }: MonthGridProps) {
  const days = getMonthGridDays(monthAnchor);
  const today = todayInClubTime();
  const weeks = chunkIntoWeeks(days);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        {weeks.map((week) => {
          const lanes = assignWeekBarLanes(bars, week[0]);
          const visibleLanes = lanes.filter((l) => l.lane < MAX_VISIBLE_LANES);
          const laneRowCount = Math.min(
            MAX_VISIBLE_LANES,
            lanes.reduce((max, l) => Math.max(max, l.lane + 1), 0)
          );

          return (
            <div key={week[0].toISOString()} className="relative grid grid-cols-7">
              {week.map((day) => {
                const coveringBars = bars.filter((bar) => barCoversDay(bar, day));
                const visibleCoveringCount = visibleLanes.filter((l) => barCoversDay(l.bar, day)).length;
                const overflow = coveringBars.length - visibleCoveringCount;
                return (
                  <DayCell
                    key={day.toISOString()}
                    day={day}
                    monthAnchor={monthAnchor}
                    today={today}
                    dominantKind={dominantKind(coveringBars.map((b) => b.kind))}
                    overflowCount={Math.max(0, overflow)}
                  />
                );
              })}
              {laneRowCount > 0 && (
                <div
                  className="pointer-events-none absolute left-0 right-0 top-6 grid grid-cols-7 gap-y-0.5 px-1"
                  style={{ gridTemplateRows: `repeat(${laneRowCount}, minmax(0, 1.1rem))` }}
                >
                  {visibleLanes.map(({ bar, startCol, endCol, lane }) => {
                    const style = getEventStyle(bar.kind);
                    return (
                      <div
                        key={bar.id}
                        className={`pointer-events-auto truncate rounded px-1 text-[10px] leading-[1.1rem] ${style.barClassName}`}
                        style={{
                          gridColumnStart: startCol + 1,
                          gridColumnEnd: endCol + 2,
                          gridRow: lane + 1,
                        }}
                        title={`${style.label}: ${bar.label}`}
                      >
                        <span className="mr-0.5">{style.icon}</span>
                        {bar.label}
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
