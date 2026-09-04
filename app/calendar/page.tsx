import Link from "next/link";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { BottomToolbar } from "@/components/calendar/BottomToolbar";
import { SidebarAccordion } from "@/components/sidebar/SidebarAccordion";
import { AcademicCalendarPanel } from "@/components/sidebar/AcademicCalendarPanel";
import { ExamSchedulePanel } from "@/components/sidebar/ExamSchedulePanel";
import { formatMonthTitle, nextMonth, previousMonth, todayInClubTime } from "@/lib/calendar/date-utils";
import { parseLayers } from "@/lib/calendar/layers";

type CalendarPageProps = {
  searchParams: Promise<{ month?: string; layers?: string }>;
};

function parseMonthParam(month: string | undefined): Date {
  if (month) {
    const [year, monthIndex] = month.split("-").map(Number);
    if (year && monthIndex && monthIndex >= 1 && monthIndex <= 12) {
      return new Date(year, monthIndex - 1, 1);
    }
  }
  const today = todayInClubTime();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function monthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { month, layers: layersParam } = await searchParams;
  const monthAnchor = parseMonthParam(month);
  const activeLayers = parseLayers(new URLSearchParams(layersParam ? { layers: layersParam } : {}));

  const layersSuffix = layersParam ? `&layers=${layersParam}` : "";

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/calendar?month=${monthParam(previousMonth(monthAnchor))}${layersSuffix}`}
            className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ◀
          </Link>
          <h1 className="min-w-40 text-center text-lg font-semibold capitalize">
            {formatMonthTitle(monthAnchor)}
          </h1>
          <Link
            href={`/calendar?month=${monthParam(nextMonth(monthAnchor))}${layersSuffix}`}
            className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ▶
          </Link>
        </div>
        <Link
          href={`/calendar${layersParam ? `?layers=${layersParam}` : ""}`}
          className="rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-700"
        >
          Bugün
        </Link>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800">
          <SidebarAccordion title="Ders Programı">
            <p className="py-4 text-center text-xs text-gray-400">Faz 4&apos;te eklenecek</p>
          </SidebarAccordion>
          <SidebarAccordion title="Sınav Programı">
            <ExamSchedulePanel activeLayers={activeLayers} />
          </SidebarAccordion>
          <SidebarAccordion title="Akademik Takvim" defaultOpen>
            <AcademicCalendarPanel activeLayers={activeLayers} />
          </SidebarAccordion>
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <MonthGrid monthAnchor={monthAnchor} />
          </div>
          <BottomToolbar activeLayers={activeLayers} />
        </div>
      </div>
    </div>
  );
}
