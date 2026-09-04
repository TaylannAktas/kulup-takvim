import "server-only";
import { eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries, examSessions, clubEvents } from "@/lib/db/schema";
import { examTypeKind, clubEventKindFromStatus } from "@/lib/calendar/color-system";
import { toClubTime } from "@/lib/calendar/date-utils";
import type { TimelineItem } from "@/components/calendar/HourlyTimeline";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Bir UTC anının Europe/Istanbul'daki gece yarısından itibaren geçen dakikası. */
function clubMinutesOfDay(instant: Date): number {
  const zoned = toClubTime(instant);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

export type DayDetail = {
  items: TimelineItem[];
  affectingAcademicEntries: Array<{ id: string; description: string; category: string }>;
  summaryText: string;
};

/**
 * Gün ayrıntı paneli için tek bir günün verisi (spec §6.5).
 * Ders oturumları henüz yok (Faz 4).
 */
export async function getDayDetail(date: Date): Promise<DayDetail> {
  const day = toDateOnly(date);

  const [academicRows, examRows, eventRows] = await Promise.all([
    db.select().from(academicCalendarEntries).where(eq(academicCalendarEntries.isActive, true)),
    db.select().from(examSessions).where(eq(examSessions.isActive, true)),
    db.select().from(clubEvents).where(ne(clubEvents.status, "iptal")),
  ]);

  const affectingAcademicEntries = academicRows
    .filter((row) => {
      const start = row.startDate ?? row.endDate;
      const end = row.endDate ?? row.startDate;
      if (!start || !end) return false;
      return toDateOnly(start) <= day && day <= toDateOnly(end);
    })
    .map((row) => ({
      id: row.id,
      description: row.description,
      category: row.categoryOverride ?? row.category,
    }));

  const dayExams = examRows.filter((row) => row.examDate && toDateOnly(row.examDate).getTime() === day.getTime());

  const dayEvents = eventRows.filter((row) => {
    const start = toDateOnly(toClubTime(row.startAt));
    const end = toDateOnly(toClubTime(row.endAt));
    return start <= day && day <= end;
  });

  const examItems: TimelineItem[] = dayExams
    .filter((row) => row.startTime && row.endTime)
    .map((row) => ({
      id: `exam:${row.id}`,
      label: row.courseCode ?? "Sınav",
      kind: examTypeKind(row.examType),
      startMinutes: timeToMinutes(row.startTime!),
      endMinutes: timeToMinutes(row.endTime!),
    }));

  const eventItems: TimelineItem[] = dayEvents
    .filter((row) => !row.isAllDay)
    .map((row) => ({
      id: `event:${row.id}`,
      label: row.title,
      kind: clubEventKindFromStatus(row.status),
      startMinutes: clubMinutesOfDay(row.startAt),
      endMinutes: clubMinutesOfDay(row.endAt),
    }));

  const items = [...examItems, ...eventItems];

  const summaryParts: string[] = [];
  if (dayExams.length > 0) summaryParts.push(`${dayExams.length} sınav`);
  if (dayEvents.length > 0) summaryParts.push(`${dayEvents.length} etkinlik`);
  const summaryText =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : affectingAcademicEntries.length > 0
        ? "Akademik takvim kaydı var"
        : "Boş gün";

  return { items, affectingAcademicEntries, summaryText };
}
