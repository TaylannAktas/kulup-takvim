"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DayDetailPanel } from "./DayDetailPanel";
import type { TimelineItem } from "./HourlyTimeline";

type DayDetailPanelContainerProps = {
  dateIso: string;
  summaryText: string;
  items: TimelineItem[];
  affectingAcademicEntries: Array<{ id: string; description: string; category: string }>;
  hrefSuffix: string;
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
  affectingAcademicEntries,
  hrefSuffix,
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
      date={new Date(dateIso)}
      summaryText={summaryText}
      items={items}
      affectingAcademicEntries={affectingAcademicEntries}
      onClose={handleClose}
      onAddEvent={canEdit ? handleAddEvent : undefined}
      onAddNote={canEdit ? handleAddNote : undefined}
    />
  );
}
