"use client";

import { HourlyTimeline, TimelineItem, TimelinePeriod } from "./HourlyTimeline";
import type { EventKind } from "@/lib/calendar/color-system";

type DayDetailPanelProps = {
  date: Date;
  summaryText: string;
  items: TimelineItem[];
  periods: TimelinePeriod[];
  notes: Array<{ id: string; body: string }>;
  affectingAcademicEntries: Array<{
    id: string;
    description: string;
    category: string;
    kind: EventKind;
  }>;
  onClose: () => void;
  onAddEvent?: () => void;
  onAddNote?: () => void;
};

export function DayDetailPanel({
  date,
  summaryText,
  items,
  periods,
  notes,
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
    <div className="flex h-96 w-full shrink-0 flex-col border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Header: date, summary, action buttons, close — one compact row (yatay panelde dikey yer kısıtlı) */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {formattedDate}
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">{summaryText}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddNote}
            disabled={!onAddNote}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              onAddNote
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            + Not ekle
          </button>
          <button
            onClick={onAddEvent}
            disabled={!onAddEvent}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              onAddEvent
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            + Etkinlik ekle
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content area: çizelge sola yaslı (kullanıcı isteği, 2026-09-07), sağda sabit
          genişlikte bir sütun — akademik takvim açıklaması (varsa) + Notlar (her zaman). */}
      <div className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto border-r border-gray-200 dark:border-gray-800">
          <HourlyTimeline
            items={items}
            periods={periods}
            academicEntries={affectingAcademicEntries.map((e) => ({
              id: e.id,
              label: e.description,
              kind: e.kind,
            }))}
            startHour={8}
            endHour={22}
          />
        </div>

        <div className="flex w-72 shrink-0 flex-col divide-y divide-gray-200 overflow-y-auto dark:divide-gray-800">
          {affectingAcademicEntries.length > 0 && (
            <div className="p-3">
              <p className="mb-2 text-xs font-semibold text-gray-900 dark:text-white">
                Bu gün neden kırmızı?
              </p>
              <div className="space-y-2">
                {affectingAcademicEntries.map((entry) => (
                  <div key={entry.id} className="space-y-0.5">
                    <div className="inline-block rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      {entry.category}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{entry.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Notlar</p>
              {onAddNote && (
                <button
                  onClick={onAddNote}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {notes.length > 0 ? "Düzenle" : "+ Not ekle"}
                </button>
              )}
            </div>
            {notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <p
                    key={note.id}
                    className="whitespace-pre-wrap rounded bg-yellow-50 p-2 text-sm text-gray-800 dark:bg-yellow-950/20 dark:text-gray-200"
                  >
                    {note.body}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Bu güne henüz not eklenmedi.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
