import Link from "next/link";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { LayersPersistence } from "@/components/calendar/LayersPersistence";
import { getMonthCalendarBars, getMonthNoteDates } from "@/lib/calendar/month-events";
import { parseLayers, isLayerActive, HEATMAP_LAYER_ID } from "@/lib/calendar/layers";
import { getMonthGridDays, formatMonthTitle, todayInClubTime, getTermMonthAnchors } from "@/lib/calendar/date-utils";

type TermPageProps = {
  searchParams: Promise<{ layers?: string }>;
};

function monthParamOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * "Dönem" görünümü — kullanıcı isteğiyle (2026-09-10) tüm aylar TEK pencerede,
 * yan yana, HİÇ scroll olmadan gösteriliyor (kompakt mini-ay ızgaraları).
 * Önceki "ay ay alt alta, dikey scroll" davranışı kaybolmadı — Ay görünümünün
 * "Tam ekran" moduna taşındı (bkz. `app/calendar/page.tsx`, `MonthScrollList`).
 *
 * Ay aralığı (içinde bulunulan aydan Temmuz 2027'ye) DEĞİŞMEDİ, sadece
 * `getTermMonthAnchors` yardımcı fonksiyonuna taşındı (Ay görünümünün tam
 * ekran modu da aynı aralığı kullanıyor).
 */
export default async function TermOverviewPage({ searchParams }: TermPageProps) {
  const { layers: layersParam } = await searchParams;
  const activeLayers = parseLayers(new URLSearchParams(layersParam ? { layers: layersParam } : {}));
  const heatmapOn = isLayerActive(activeLayers, HEATMAP_LAYER_ID);

  const today = todayInClubTime();
  const monthAnchors = getTermMonthAnchors(today);
  const startAnchor = monthAnchors[0];
  const endAnchor = monthAnchors[monthAnchors.length - 1];

  const months = await Promise.all(
    monthAnchors.map(async (anchor) => {
      const gridDays = getMonthGridDays(anchor);
      const [{ bars, academicDayEntries }, noteDates] = await Promise.all([
        getMonthCalendarBars(gridDays[0], gridDays[gridDays.length - 1], activeLayers),
        getMonthNoteDates(gridDays[0], gridDays[gridDays.length - 1]),
      ]);
      return { anchor, bars, academicDayEntries, noteDates };
    })
  );

  const layersSuffix = layersParam ? `&layers=${layersParam}` : "";

  return (
    <div className="flex h-screen flex-col">
      <LayersPersistence />
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
      {/* Dış kapsayıcıda `overflow-y-auto` bilinçli bir güvenlik ağı: normal
          masaüstü ekranında kompakt hücrelerle tüm dönem sığıp scrollbar hiç
          tetiklenmemeli — ama gerçekten sığmayan çok küçük ekranlarda içerik
          `overflow-hidden` ile sessizce kırpılıp veri kaybı gibi görünmesin
          diye scroll'a izin veriliyor. */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {months.map(({ anchor, bars, academicDayEntries, noteDates }) => (
            <div
              key={anchor.toISOString()}
              className="flex h-64 flex-col overflow-hidden rounded border border-gray-200 dark:border-gray-800"
            >
              <h2 className="shrink-0 border-b border-gray-200 px-2 py-1 text-xs font-semibold capitalize text-gray-700 dark:border-gray-800 dark:text-gray-300">
                {formatMonthTitle(anchor)}
              </h2>
              <div className="min-h-0 flex-1 overflow-hidden">
                <MonthGrid
                  monthAnchor={anchor}
                  bars={bars}
                  academicDayEntries={academicDayEntries}
                  noteDates={noteDates}
                  heatmapOn={heatmapOn}
                  dayHrefBase={`/calendar?month=${monthParamOf(anchor)}${layersSuffix}`}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
