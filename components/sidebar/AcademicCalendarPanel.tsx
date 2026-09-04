import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries } from "@/lib/db/schema";
import { auth } from "@/auth";
import { todayInClubTime } from "@/lib/calendar/date-utils";
import { makeLayerId, isLayerActive } from "@/lib/calendar/layers";
import { CategoryOverrideSelect } from "./CategoryOverrideSelect";
import { TodayAnchor } from "./TodayAnchor";

const CATEGORY_LABELS: Record<string, string> = {
  SINAV: "Sınav",
  TATIL: "Tatil",
  DERS_DONEMI: "Ders dönemi",
  KAYIT: "Kayıt",
  IDARI: "İdari",
};

const LAYER_NAMESPACE = "academic-category";

function formatEntryDate(start: Date | null, end: Date | null): string {
  const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return "(tarih yok)";
}

type AcademicCalendarPanelProps = {
  activeLayers: Set<string>;
};

export async function AcademicCalendarPanel({ activeLayers }: AcademicCalendarPanelProps) {
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
      <div className="flex flex-wrap gap-1">
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => {
          const layerId = makeLayerId(LAYER_NAMESPACE, value);
          const active = isLayerActive(activeLayers, layerId);
          const nextLayers = new Set(activeLayers);
          if (active) nextLayers.delete(layerId);
          else nextLayers.add(layerId);
          return (
            <Link
              key={value}
              href={`?layers=${[...nextLayers].sort().join(",")}`}
              scroll={false}
              className={[
                "rounded-full border px-2 py-0.5 text-xs",
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {visibleRows.map((row) => {
          const effective = row.categoryOverride ?? row.category;
          const monthAnchor = row.startDate ?? row.endDate;
          const monthParam = monthAnchor
            ? `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`
            : undefined;
          return (
            <li key={row.id} className="relative py-2">
              {row.id === closestId && <TodayAnchor />}
              <Link
                href={monthParam ? `/calendar?month=${monthParam}` : "#"}
                className="block hover:underline"
              >
                <div className="text-xs text-gray-500">{formatEntryDate(row.startDate, row.endDate)}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[effective] ?? effective}
                  </span>
                  <span>{row.description}</span>
                </div>
              </Link>
              <CategoryOverrideSelect
                entryId={row.id}
                currentCategory={row.category}
                currentOverride={row.categoryOverride}
                canEdit={canEdit}
              />
            </li>
          );
        })}
        {visibleRows.length === 0 && (
          <li className="py-4 text-center text-xs text-gray-400">Kayıt yok</li>
        )}
      </ul>
    </div>
  );
}
