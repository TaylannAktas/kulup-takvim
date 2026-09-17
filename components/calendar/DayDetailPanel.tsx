"use client";

import { useState } from "react";
import { HourlyTimeline, TimelineItem, TimelinePeriod } from "./HourlyTimeline";
import type { EventKind } from "@/lib/calendar/color-system";
import { collapseTimelineItems, type TimelineGroup } from "@/lib/calendar/grouping";

const SECTIONS: Array<{ group: TimelineGroup; title: string; noun: string }> = [
  { group: "event", title: "Etkinlikler", noun: "etkinlik" },
  { group: "exam", title: "Sınavlar", noun: "sınav" },
  { group: "course", title: "Dersler", noun: "ders" },
];

/** Bu kadar ya da daha az öğesi olan bölüm açık başlar. */
const AUTO_EXPAND_LIMIT = 6;

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
  const sectionCounts = SECTIONS.map((s) => ({ ...s, count: items.filter((i) => i.group === s.group).length }));
  // Kalabalık bölümler kapalı başlar (kullanıcı isteği, 2026-09-17): çizelge
  // yüzlerce kutuya boğulmasın; kapalı bölüm silinmez, çakışan saatleri tek
  // "N sınav" satırına iner. Etkinlikler her zaman açık başlar.
  const [expanded, setExpanded] = useState<Record<TimelineGroup, boolean>>(() => ({
    event: true,
    exam: sectionCounts.find((s) => s.group === "exam")!.count <= AUTO_EXPAND_LIMIT,
    course: sectionCounts.find((s) => s.group === "course")!.count <= AUTO_EXPAND_LIMIT,
  }));
  const visibleItems = SECTIONS.reduce(
    (acc, s) => (expanded[s.group] ? acc : collapseTimelineItems(acc, s.group, s.noun)),
    items
  );

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
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-800">
          {sectionCounts.some((s) => s.count > 0) && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 px-2 py-1.5 dark:border-gray-800">
              {sectionCounts
                .filter((s) => s.count > 0)
                .map((s) => (
                  <button
                    key={s.group}
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [s.group]: !prev[s.group] }))}
                    aria-pressed={expanded[s.group]}
                    title={expanded[s.group] ? "Tek satıra topla" : "Tek tek göster"}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                      expanded[s.group]
                        ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {expanded[s.group] ? "▾" : "▸"} {s.title} ({s.count})
                  </button>
                ))}
            </div>
          )}
          <HourlyTimeline
            items={visibleItems}
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
