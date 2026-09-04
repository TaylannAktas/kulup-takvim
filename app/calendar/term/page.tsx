import Link from "next/link";
import { eachDayOfInterval } from "date-fns";
import { TermHeatmap, type TermHeatmapDay } from "@/components/calendar/TermHeatmap";
import { getMonthCalendarBars, dominantKind } from "@/lib/calendar/month-events";
import { parseLayers } from "@/lib/calendar/layers";
import { currentAcademicYear, currentTerm, termDateRange, type Term } from "@/lib/calendar/academic-year";

type TermPageProps = {
  searchParams: Promise<{ year?: string; term?: string; layers?: string }>;
};

const TERM_LABELS: Record<Term, string> = { guz: "Güz", bahar: "Bahar", yaz: "Yaz" };

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default async function TermHeatmapPage({ searchParams }: TermPageProps) {
  const { year, term: termParam, layers: layersParam } = await searchParams;
  const sourceYear = year ?? currentAcademicYear();
  const term: Term = termParam === "guz" || termParam === "bahar" || termParam === "yaz" ? termParam : currentTerm();
  const activeLayers = parseLayers(new URLSearchParams(layersParam ? { layers: layersParam } : {}));

  const { start, end } = termDateRange(sourceYear, term);
  const bars = await getMonthCalendarBars(start, end, activeLayers);

  const days = eachDayOfInterval({ start, end }).map((date) => {
    const dateOnly = toDateOnly(date);
    const covering = bars.filter((bar) => bar.startDate <= dateOnly && dateOnly <= bar.endDate);
    return {
      date: dateOnly,
      dominantKind: dominantKind(covering.map((b) => b.kind)),
      count: covering.length,
    } satisfies TermHeatmapDay;
  });

  const querySuffix = layersParam ? `&layers=${layersParam}` : "";

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Dönem Görünümü</h1>
          <span className="text-sm text-gray-400">
            {sourceYear} · {TERM_LABELS[term]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["guz", "bahar", "yaz"] as const).map((t) => (
            <Link
              key={t}
              href={`/calendar/term?year=${sourceYear}&term=${t}${querySuffix}`}
              className={[
                "rounded px-2 py-1 text-sm",
                t === term
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              {TERM_LABELS[t]}
            </Link>
          ))}
          <Link href="/calendar" className="ml-3 rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-700">
            Ay görünümüne dön
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <TermHeatmap days={days} />
        <p className="px-4 pb-4 text-xs text-gray-400">
          Dönem tarih aralığı yaklaşık bir varsayımdır (akademik takvimden kesin dönem
          sınırları henüz otomatik çıkarılmıyor) — gerekirse{" "}
          <code>?year=2026-2027&amp;term=guz</code> ile elle ayarlayın.
        </p>
      </div>
    </div>
  );
}
