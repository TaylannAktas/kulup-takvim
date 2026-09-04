"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DayDetailPanel } from "./DayDetailPanel";
import type { TimelineItem } from "./HourlyTimeline";

type DayDetailPanelContainerProps = {
  dateIso: string;
  summaryText: string;
  items: TimelineItem[];
  affectingAcademicEntries: Array<{ id: string; description: string; category: string }>;
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
}: DayDetailPanelContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("day");
    router.push(`/calendar${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  return (
    <DayDetailPanel
      date={new Date(dateIso)}
      summaryText={summaryText}
      items={items}
      affectingAcademicEntries={affectingAcademicEntries}
      onClose={handleClose}
    />
  );
}
