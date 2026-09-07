import Link from "next/link";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { getMonthCalendarBars, getMonthNoteDates } from "@/lib/calendar/month-events";
import { parseLayers, isLayerActive, HEATMAP_LAYER_ID } from "@/lib/calendar/layers";
import { getMonthGridDays, formatMonthTitle, todayInClubTime } from "@/lib/calendar/date-utils";

type TermPageProps = {
  searchParams: Promise<{ layers?: string }>;
};

/**
 * "Dönem" görünümü — kullanıcı isteğiyle (2026-09-08) eski GitHub-katkı-grafiği
 * tarzı ısı haritasından (bkz. git geçmişi, `TermHeatmap.tsx` — artık kullanılmıyor,
 * ısı haritası kavramı Ay görünümüne bir KATMAN olarak taşındı, bkz.
 * DECISIONS.md) tamamen normal aylık görünümün ardı ardına, kaydırılabilir bir
 * listesine dönüştürüldü: içinde bulunulan aydan Temmuz 2027'ye kadar HER ay
 * kendi tam takvim ızgarasıyla gösteriliyor.
 *
 * Bitiş tarihi (Temmuz 2027) şimdilik sabit — kullanıcı bunu istedi. İleride
 * akademik yıl sonuna göre dinamikleştirilebilir (bkz. lib/calendar/academic-year.ts).
 */
const RANGE_END_YEAR = 2027;
const RANGE_END_MONTH_INDEX = 6; // 0-tabanlı: 6 = Temmuz

function monthParamOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function TermOverviewPage({ searchParams }: TermPageProps) {
  const { layers: layersParam } = await searchParams;
  const activeLayers = parseLayers(new URLSearchParams(layersParam ? { layers: layersParam } : {}));
  const heatmapOn = isLayerActive(activeLayers, HEATMAP_LAYER_ID);

  const today = todayInClubTime();
  const startAnchor = new Date(today.getFullYear(), today.getMonth(), 1);
  const endAnchor = new Date(RANGE_END_YEAR, RANGE_END_MONTH_INDEX, 1);

  const monthAnchors: Date[] = [];
  for (
    let anchor = new Date(startAnchor);
    anchor <= endAnchor;
    anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  ) {
    monthAnchors.push(anchor);
  }

  const months = await Promise.all(
    monthAnchors.map(async (anchor) => {
      const gridDays = getMonthGridDays(anchor);
      const [{ bars, academicEdges }, noteDates] = await Promise.all([
        getMonthCalendarBars(gridDays[0], gridDays[gridDays.length - 1], activeLayers),
        getMonthNoteDates(gridDays[0], gridDays[gridDays.length - 1]),
      ]);
      return { anchor, bars, academicEdges, noteDates };
    })
  );

  const layersSuffix = layersParam ? `&layers=${layersParam}` : "";

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-800">
        <div>
          <h1 className="text-lg font-semibold">Dönem Görünümü</h1>
          <p className="text-xs text-gray-400">
            {formatMonthTitle(startAnchor)} — {formatMonthTitle(endAnchor)}
          </p>
        </div>
        <Link
          href={`/calendar${layersParam ? `?layers=${layersParam}` : ""}`}
          className="rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-700"
        >
          Ay görünümüne dön
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {months.map(({ anchor, bars, academicEdges, noteDates }) => (
          <div key={anchor.toISOString()} className="border-b border-gray-200 dark:border-gray-800">
            <h2 className="px-3 pt-3 pb-1 text-sm font-semibold capitalize text-gray-700 dark:text-gray-300">
              {formatMonthTitle(anchor)}
            </h2>
            <div className="h-[420px]">
              <MonthGrid
                monthAnchor={anchor}
                bars={bars}
                academicEdges={academicEdges}
                noteDates={noteDates}
                heatmapOn={heatmapOn}
                dayHrefBase={`/calendar?month=${monthParamOf(anchor)}${layersSuffix}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
