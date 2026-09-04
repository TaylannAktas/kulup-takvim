import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries, examSessions } from "@/lib/db/schema";
import { examTypeKind } from "@/lib/calendar/color-system";
import type { TimelineItem } from "@/components/calendar/HourlyTimeline";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type DayDetail = {
  items: TimelineItem[];
  affectingAcademicEntries: Array<{ id: string; description: string; category: string }>;
  summaryText: string;
};

/**
 * Gün ayrıntı paneli için tek bir günün verisi (spec §6.5).
 * Ders oturumları ve kulüp etkinlikleri henüz yok (Faz 3/4) — o kaynaklar
 * eklendiğinde buraya birleştirilecek.
 */
export async function getDayDetail(date: Date): Promise<DayDetail> {
  const day = toDateOnly(date);

  const [academicRows, examRows] = await Promise.all([
    db.select().from(academicCalendarEntries).where(eq(academicCalendarEntries.isActive, true)),
    db.select().from(examSessions).where(eq(examSessions.isActive, true)),
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

  const items: TimelineItem[] = dayExams
    .filter((row) => row.startTime && row.endTime)
    .map((row) => ({
      id: row.id,
      label: row.courseCode ?? "Sınav",
      kind: examTypeKind(row.examType),
      startMinutes: timeToMinutes(row.startTime!),
      endMinutes: timeToMinutes(row.endTime!),
    }));

  const summaryText =
    dayExams.length > 0 ? `${dayExams.length} sınav` : affectingAcademicEntries.length > 0 ? "Akademik takvim kaydı var" : "Boş gün";

  return { items, affectingAcademicEntries, summaryText };
}
