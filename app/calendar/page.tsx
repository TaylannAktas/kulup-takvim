import Link from "next/link";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { KeyboardGridNav } from "@/components/calendar/KeyboardGridNav";
import { BottomToolbar } from "@/components/calendar/BottomToolbar";
import { DayDetailPanelContainer } from "@/components/calendar/DayDetailPanelContainer";
import { EventModal } from "@/components/events/EventModal";
import { DayNoteModal } from "@/components/notes/DayNoteModal";
import { SidebarAccordion } from "@/components/sidebar/SidebarAccordion";
import { AcademicCalendarPanel } from "@/components/sidebar/AcademicCalendarPanel";
import { ExamSchedulePanel } from "@/components/sidebar/ExamSchedulePanel";
import { CourseSchedulePanel } from "@/components/sidebar/CourseSchedulePanel";
import {
  formatMonthTitle,
  getMonthGridDays,
  nextMonth,
  previousMonth,
  todayInClubTime,
} from "@/lib/calendar/date-utils";
import { parseLayers } from "@/lib/calendar/layers";
import { getMonthCalendarBars } from "@/lib/calendar/month-events";
import { getDayDetail } from "@/lib/calendar/day-detail";
import { auth } from "@/auth";

type CalendarPageProps = {
  searchParams: Promise<{
    month?: string;
    layers?: string;
    day?: string;
    newEvent?: string;
    editEvent?: string;
    newNote?: string;
  }>;
};

function parseDayParam(day: string | undefined): Date | null {
  if (!day) return null;
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

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
  const { month, layers: layersParam, day: dayParam, newEvent, editEvent, newNote } = await searchParams;
  const session = await auth();
  const canEdit = session?.user?.role === "admin" || session?.user?.role === "editor";

  const monthAnchor = parseMonthParam(month);
  const activeLayers = parseLayers(new URLSearchParams(layersParam ? { layers: layersParam } : {}));
  const selectedDay = parseDayParam(dayParam);

  const gridDays = getMonthGridDays(monthAnchor);
  const [bars, dayDetail] = await Promise.all([
    getMonthCalendarBars(gridDays[0], gridDays[gridDays.length - 1], activeLayers),
    selectedDay ? getDayDetail(selectedDay) : Promise.resolve(null),
  ]);

  const layersSuffix = layersParam ? `&layers=${layersParam}` : "";
  const dayHrefBase = `/calendar?month=${monthParam(monthAnchor)}${layersSuffix}`;
  const fullQueryString = new URLSearchParams({
    ...(month && { month }),
    ...(layersParam && { layers: layersParam }),
    ...(dayParam && { day: dayParam }),
  }).toString();
  const hrefSuffix = fullQueryString ? `?${fullQueryString}` : "";

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
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="no-print flex w-full lg:w-80 shrink-0 flex-col overflow-hidden border-b border-gray-200 lg:border-b-0 lg:border-r dark:border-gray-800">
          <SidebarAccordion title="Ders Programı">
            <CourseSchedulePanel />
          </SidebarAccordion>
          <SidebarAccordion title="Sınav Programı">
            <ExamSchedulePanel
              activeLayers={activeLayers}
              monthParam={monthParam(monthAnchor)}
              dayParam={dayParam}
            />
          </SidebarAccordion>
          <SidebarAccordion title="Akademik Takvim" defaultOpen>
            <AcademicCalendarPanel
              activeLayers={activeLayers}
              monthParam={monthParam(monthAnchor)}
              dayParam={dayParam}
            />
          </SidebarAccordion>
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="flex-1 overflow-auto">
            <KeyboardGridNav>
              <MonthGrid
                monthAnchor={monthAnchor}
                bars={bars}
                dayHrefBase={dayHrefBase}
                selectedDayIso={dayParam}
              />
            </KeyboardGridNav>
          </div>
          <BottomToolbar activeLayers={activeLayers} hrefSuffix={hrefSuffix} canEdit={canEdit} />
        </div>
        {selectedDay && dayDetail && (
          <DayDetailPanelContainer
            dateIso={selectedDay.toISOString()}
            summaryText={dayDetail.summaryText}
            items={dayDetail.items}
            affectingAcademicEntries={dayDetail.affectingAcademicEntries}
            hrefSuffix={hrefSuffix}
            canEdit={canEdit}
          />
        )}
      </div>

      {/* Event modals */}
      {newEvent && <EventModal mode="create" defaultDate={dayParam} canEdit={canEdit} />}
      {editEvent && <EventModal mode="edit" eventId={editEvent} canEdit={canEdit} />}

      {/* Day note modal */}
      {newNote && <DayNoteModal date={dayParam || new Date().toISOString().split("T")[0]} canEdit={canEdit} />}
    </div>
  );
}
