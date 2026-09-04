import { DayCell } from "./DayCell";
import { getMonthGridDays, todayInClubTime } from "@/lib/calendar/date-utils";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

type MonthGridProps = {
  monthAnchor: Date;
};

export function MonthGrid({ monthAnchor }: MonthGridProps) {
  const days = getMonthGridDays(monthAnchor);
  const today = todayInClubTime();

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7">
        {days.map((day) => (
          <DayCell key={day.toISOString()} day={day} monthAnchor={monthAnchor} today={today} />
        ))}
      </div>
    </div>
  );
}
