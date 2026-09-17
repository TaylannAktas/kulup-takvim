"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DayDetailPanel } from "./DayDetailPanel";
import type { TimelineItem, TimelinePeriod } from "./HourlyTimeline";
import type { EventKind } from "@/lib/calendar/color-system";

type DayDetailPanelContainerProps = {
  dateIso: string;
  summaryText: string;
  items: TimelineItem[];
  periods: TimelinePeriod[];
  notes: Array<{ id: string; body: string }>;
  affectingAcademicEntries: Array<{ id: string; description: string; category: string; kind: EventKind }>;
  canEdit: boolean;
};

/**
 * DayDetailPanel'in sunucudan gelen verceriyi alıp `onClose`'u istemci
 * tarafında (URL'den `day` parametresini kaldırarak) yönetmesini sağlayan
 * ince sarmalayıcı.
 */
export function DayDetailPanelContainer({
  dateIso,
  summaryText,
  items,
  periods,
  notes,
  affectingAcademicEntries,
  canEdit,
}: DayDetailPanelContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("day");
    router.push(`/calendar${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  function handleAddEvent() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("newEvent", "1");
    router.push(`/calendar?${params.toString()}`, { scroll: false });
  }

  function handleAddNote() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("newNote", "1");
    router.push(`/calendar?${params.toString()}`, { scroll: false });
  }

  return (
    <DayDetailPanel
      // Gün değişince bölümlerin aç/kapa durumu yeni günün yoğunluğuna göre sıfırlansın.
      key={dateIso}
      date={new Date(dateIso)}
      summaryText={summaryText}
      items={items}
      periods={periods}
      notes={notes}
      affectingAcademicEntries={affectingAcademicEntries}
      onClose={handleClose}
      onAddEvent={canEdit ? handleAddEvent : undefined}
      onAddNote={canEdit ? handleAddNote : undefined}
    />
  );
}
