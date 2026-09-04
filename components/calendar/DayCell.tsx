import Link from "next/link";
import { formatDayNumber, isSameDay, isSameMonth, isWeekend } from "@/lib/calendar/date-utils";
import { getEventStyle, type EventKind } from "@/lib/calendar/color-system";

type DayCellProps = {
  day: Date;
  monthAnchor: Date;
  today: Date;
  dominantKind: EventKind | null;
  /** Bu güne denk gelen ama hafta şeridi olarak değil hücre içinde gösterilecek satırlar (spec "+2 daha" taşması). */
  overflowCount: number;
  href?: string;
  selected?: boolean;
  /** 0-based index in the flattened month grid for keyboard navigation (spec §7.6). */
  dayIndex?: number;
};

export function DayCell({ day, monthAnchor, today, dominantKind, overflowCount, href, selected, dayIndex }: DayCellProps) {
  const inCurrentMonth = isSameMonth(day, monthAnchor);
  const isToday = isSameDay(day, today);
  const weekend = isWeekend(day);
  const dominantStyle = dominantKind ? getEventStyle(dominantKind) : null;

  const className = [
    "flex min-h-24 flex-col gap-1 border border-gray-200 p-1.5 dark:border-gray-800",
    inCurrentMonth ? "bg-white dark:bg-gray-950" : "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600",
    weekend && inCurrentMonth ? "bg-gray-50/70 dark:bg-gray-900/40" : "",
    inCurrentMonth && dominantStyle?.cellBackgroundClassName ? dominantStyle.cellBackgroundClassName : "",
    href ? "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-blue-400" : "",
    selected ? "ring-2 ring-inset ring-blue-600" : "",
  ].join(" ");

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={[
            "self-start rounded-full px-1.5 text-sm",
            isToday ? "bg-blue-600 font-semibold text-white" : "",
          ].join(" ")}
        >
          {formatDayNumber(day)}
        </span>
        {dominantStyle && (
          <span className="text-[10px] text-gray-500" title={dominantStyle.label}>
            {dominantStyle.icon}
          </span>
        )}
      </div>
      <div className="mt-auto" />
      {overflowCount > 0 && <span className="text-[10px] text-gray-500">+{overflowCount} daha</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} scroll={false} className={className} data-day-index={dayIndex}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} data-day-index={dayIndex}>
      {content}
    </div>
  );
}
