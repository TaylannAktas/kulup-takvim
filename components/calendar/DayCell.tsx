import { formatDayNumber, isSameDay, isSameMonth, isWeekend } from "@/lib/calendar/date-utils";

type DayCellProps = {
  day: Date;
  monthAnchor: Date;
  today: Date;
};

export function DayCell({ day, monthAnchor, today }: DayCellProps) {
  const inCurrentMonth = isSameMonth(day, monthAnchor);
  const isToday = isSameDay(day, today);
  const weekend = isWeekend(day);

  return (
    <div
      className={[
        "flex min-h-24 flex-col gap-1 border border-gray-200 p-1.5 dark:border-gray-800",
        inCurrentMonth ? "bg-white dark:bg-gray-950" : "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600",
        weekend && inCurrentMonth ? "bg-gray-50/70 dark:bg-gray-900/40" : "",
      ].join(" ")}
    >
      <span
        className={[
          "self-start rounded-full px-1.5 text-sm",
          isToday ? "bg-blue-600 font-semibold text-white" : "",
        ].join(" ")}
      >
        {formatDayNumber(day)}
      </span>
      {/* Etkinlik/sınav/tatil çubukları Faz 2-3'te buraya eklenecek. */}
    </div>
  );
}
