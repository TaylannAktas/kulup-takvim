"use client";

import type { AvailabilitySlot } from "@/lib/availability/overlap";

type AvailabilityHeatmapProps = {
  slots: AvailabilitySlot[];
};

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getFreeRatio(slot: AvailabilitySlot): number {
  return slot.totalCount > 0 ? slot.freeCount / slot.totalCount : 0;
}

function getBackgroundColor(ratio: number): string {
  // Blue scale: lighter blue for more free people, darker for less
  if (ratio >= 0.9) return "#e0f2fe"; // sky-100
  if (ratio >= 0.7) return "#bae6fd"; // sky-200
  if (ratio >= 0.5) return "#7dd3fc"; // sky-300
  if (ratio >= 0.3) return "#38bdf8"; // sky-400
  return "#0284c7"; // sky-600
}

export function AvailabilityHeatmap({ slots }: AvailabilityHeatmapProps) {
  if (slots.length === 0) {
    return <p className="text-sm text-gray-500">Hiçbir zaman aralığı bulunmadı.</p>;
  }

  // Group slots by weekday and sort by startMinutes
  const byWeekday = new Map<number, AvailabilitySlot[]>();
  for (const slot of slots) {
    if (!byWeekday.has(slot.weekday)) {
      byWeekday.set(slot.weekday, []);
    }
    byWeekday.get(slot.weekday)!.push(slot);
  }

  // Sort each weekday's slots by startMinutes
  for (const [, daySlots] of byWeekday) {
    daySlots.sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // Get all unique time slots across all days
  const allStartTimes = new Set<number>();
  for (const slot of slots) {
    allStartTimes.add(slot.startMinutes);
  }
  const sortedTimes = Array.from(allStartTimes).sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
      <table className="w-full border-collapse bg-white dark:bg-gray-950">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="bg-gray-50 px-2 py-2 text-right text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-400">
              Saat
            </th>
            {WEEKDAY_LABELS.map((label) => (
              <th
                key={label}
                className="bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-400"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedTimes.map((startMinutes) => (
            <tr key={startMinutes} className="border-b border-gray-100 dark:border-gray-900">
              <td className="whitespace-nowrap bg-gray-50 px-2 py-2 text-right text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                {minutesToTime(startMinutes)}
              </td>
              {Array.from({ length: 6 }, (_, weekday) => {
                weekday += 1; // Convert to 1-indexed
                const daySlots = byWeekday.get(weekday) ?? [];
                const slot = daySlots.find((s) => s.startMinutes === startMinutes);

                if (!slot) {
                  return (
                    <td
                      key={weekday}
                      className="border-r border-gray-100 px-2 py-3 text-center dark:border-gray-900"
                    >
                      —
                    </td>
                  );
                }

                const ratio = getFreeRatio(slot);
                const bgColor = getBackgroundColor(ratio);

                return (
                  <td
                    key={weekday}
                    className="border-r border-gray-100 px-2 py-3 text-center dark:border-gray-900"
                    style={{
                      backgroundColor: bgColor,
                    }}
                  >
                    <span className="text-xs font-medium text-gray-900">
                      {slot.freeCount}/{slot.totalCount}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded"
            style={{ backgroundColor: "#e0f2fe" }}
          />
          <span>90-100% boş</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded"
            style={{ backgroundColor: "#bae6fd" }}
          />
          <span>70-90% boş</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded"
            style={{ backgroundColor: "#7dd3fc" }}
          />
          <span>50-70% boş</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded"
            style={{ backgroundColor: "#38bdf8" }}
          />
          <span>30-50% boş</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded"
            style={{ backgroundColor: "#0284c7" }}
          />
          <span>0-30% boş</span>
        </div>
      </div>
    </div>
  );
}
