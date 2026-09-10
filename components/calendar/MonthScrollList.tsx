import { MonthGrid } from "./MonthGrid";
import { formatMonthTitle } from "@/lib/calendar/date-utils";
import type { CalendarBarItem, AcademicDayEntry } from "@/lib/calendar/month-events";

function monthParamOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type MonthScrollListProps = {
  months: Array<{
    anchor: Date;
    bars: CalendarBarItem[];
    academicDayEntries: Map<string, AcademicDayEntry[]>;
    noteDates: Set<string>;
  }>;
  heatmapOn?: boolean;
  layersSuffix: string;
};

/**
 * Ay ay alt alta, dikey scroll ile gezilen tam-boy dönem listesi — dönem
 * görünümünün (`/calendar/term`) BUGÜNKÜ (2026-09-10 öncesi) davranışıydı;
 * dönem görünümü kompakt/yan-yana mini-ay ızgarasına geçince bu davranış
 * kaybolmasın diye buraya taşındı ve Ay görünümünün "Tam ekran" moduna
 * bağlandı (`app/calendar/page.tsx`, `fullscreen=1`).
 *
 * Her ayın kutusu SABİT yükseklikte DEĞİL (kullanıcı raporu, 2026-09-10:
 * sabit `h-[420px]` gerçek ay ızgarasından — haftalık başlık + 5-6 satır ×
 * `min-h-24` hücre, kolayca 500-600px — daha kısaydı, taşan içerik bir
 * sonraki ayın üzerine biniyordu ve hangi ayda olunduğu belli olmuyordu).
 * Artık her ay kendi içeriğine göre doğal yüksekliğe büyüyor, taşma/binme
 * olmuyor. Ay başlığı `sticky top-0` — scroll ederken hangi ayda olunduğu,
 * bir sonraki ayın başlığı onu yukarı itene kadar üstte sabit kalıyor.
 */
export function MonthScrollList({ months, heatmapOn, layersSuffix }: MonthScrollListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {months.map(({ anchor, bars, academicDayEntries, noteDates }) => (
        <div key={anchor.toISOString()} className="border-b border-gray-200 dark:border-gray-800">
          <h2 className="sticky top-0 z-10 border-b border-gray-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {formatMonthTitle(anchor)}
          </h2>
          <MonthGrid
            monthAnchor={anchor}
            bars={bars}
            academicDayEntries={academicDayEntries}
            noteDates={noteDates}
            heatmapOn={heatmapOn}
            dayHrefBase={`/calendar?month=${monthParamOf(anchor)}${layersSuffix}`}
          />
        </div>
      ))}
    </div>
  );
}
