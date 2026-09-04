"use client";

import { HourlyTimeline, TimelineItem } from "./HourlyTimeline";

type DayDetailPanelProps = {
  date: Date;
  summaryText: string;
  items: TimelineItem[];
  affectingAcademicEntries: Array<{
    id: string;
    description: string;
    category: string;
  }>;
  onClose: () => void;
  onAddEvent?: () => void;
  onAddNote?: () => void;
};

export function DayDetailPanel({
  date,
  summaryText,
  items,
  affectingAcademicEntries,
  onClose,
  onAddEvent,
  onAddNote,
}: DayDetailPanelProps) {
  const formattedDate = date.toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 h-full">
      {/* Header: close button, date, summary */}
      <div className="shrink-0 border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {formattedDate}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {summaryText}
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content area: timeline + academic entries */}
      <div className="flex-1 overflow-y-auto">
        {/* HourlyTimeline component */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <HourlyTimeline items={items} startHour={8} endHour={22} />
        </div>

        {/* "Bu gün neden kırmızı?" section — only render if there are entries */}
        {affectingAcademicEntries.length > 0 && (
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <details className="space-y-2">
              <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white">
                Bu gün neden kırmızı?
              </summary>
              <div className="space-y-2 pt-2">
                {affectingAcademicEntries.map((entry) => (
                  <div key={entry.id} className="space-y-0.5">
                    <div className="inline-block rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      {entry.category}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {entry.description}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Action buttons: fixed at bottom */}
      <div className="shrink-0 border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex flex-col gap-2">
          <button
            onClick={onAddNote}
            disabled={!onAddNote}
            className={`rounded px-3 py-2 text-sm font-medium transition ${
              onAddNote
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            + Bu güne not ekle
          </button>
          <button
            onClick={onAddEvent}
            disabled={!onAddEvent}
            className={`rounded px-3 py-2 text-sm font-medium transition ${
              onAddEvent
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            + Bu güne etkinlik ekle
          </button>
        </div>
      </div>
    </div>
  );
}
