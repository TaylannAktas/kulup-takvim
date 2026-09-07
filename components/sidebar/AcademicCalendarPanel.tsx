import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries } from "@/lib/db/schema";
import { auth } from "@/auth";
import { todayInClubTime } from "@/lib/calendar/date-utils";
import { makeLayerId, isLayerActive } from "@/lib/calendar/layers";
import { AcademicEntrySearchList } from "./AcademicEntrySearchList";
import { FilterCheckboxRow } from "./FilterCheckboxRow";

const CATEGORY_LABELS: Record<string, string> = {
  SINAV: "Sınav",
  TATIL: "Tatil",
  DERS_DONEMI: "Ders dönemi",
  KAYIT: "Kayıt",
  IDARI: "İdari",
};

const LAYER_NAMESPACE = "academic-category";

type AcademicCalendarPanelProps = {
  activeLayers: Set<string>;
  /** Filtre çipleri tıklanınca ay/gün durumu kaybolmasın diye (bkz. sayfa üstü hrefSuffix mantığı). */
  monthParam: string;
  dayParam?: string;
};

export async function AcademicCalendarPanel({
  activeLayers,
  monthParam: currentMonthParam,
  dayParam: currentDayParam,
}: AcademicCalendarPanelProps) {
  const [session, rows] = await Promise.all([
    auth(),
    db
      .select()
      .from(academicCalendarEntries)
      .where(eq(academicCalendarEntries.isActive, true))
      .orderBy(asc(academicCalendarEntries.startDate)),
  ]);

  const canEdit = session?.user?.role === "admin" || session?.user?.role === "editor";
  const today = todayInClubTime();

  const activeCategoryFilters = Object.keys(CATEGORY_LABELS).filter((cat) =>
    isLayerActive(activeLayers, makeLayerId(LAYER_NAMESPACE, cat))
  );

  const visibleRows = rows.filter((row) => {
    if (activeCategoryFilters.length === 0) return true;
    const effective = row.categoryOverride ?? row.category;
    return activeCategoryFilters.includes(effective);
  });

  let closestId: string | null = null;
  let closestDiff = Infinity;
  for (const row of rows) {
    const anchor = row.startDate ?? row.endDate;
    if (!anchor) continue;
    const diff = Math.abs(anchor.getTime() - today.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closestId = row.id;
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <AcademicEntrySearchList rows={visibleRows} closestId={closestId} canEdit={canEdit}>
        <div className="flex flex-col">
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => {
            const layerId = makeLayerId(LAYER_NAMESPACE, value);
            const active = isLayerActive(activeLayers, layerId);
            const nextLayers = new Set(activeLayers);
            if (active) nextLayers.delete(layerId);
            else nextLayers.add(layerId);
            const nextHref = `/calendar?month=${currentMonthParam}${
              currentDayParam ? `&day=${currentDayParam}` : ""
            }${nextLayers.size > 0 ? `&layers=${[...nextLayers].sort().join(",")}` : ""}`;
            return <FilterCheckboxRow key={value} href={nextHref} active={active} label={label} />;
          })}
        </div>
      </AcademicEntrySearchList>
    </div>
  );
}
