import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries, examSessions } from "@/lib/db/schema";
import {
  academicCalendarKindFromCategory,
  examTypeKind,
  type EventKind,
} from "@/lib/calendar/color-system";
import { makeLayerId, isLayerActive } from "@/lib/calendar/layers";
import { FACULTY_CODES } from "@/lib/scrapers/exam-schedule/fetch";

export type CalendarBarItem = {
  id: string;
  label: string;
  kind: EventKind;
  /** Dahil (inclusive), saat bilgisi olmadan gün bazlı. */
  startDate: Date;
  endDate: Date;
};

/** Hücre zemininin hangi türe göre tonlanacağını belirleyen öncelik sırası (spec §6.5). */
const DOMINANCE_ORDER: EventKind[] = [
  "exam_final",
  "exam_arasinav",
  "exam_mazeret",
  "academic_tatil",
  "academic_ders_donemi",
  "academic_kayit",
  "academic_idari",
  "course_session",
  "club_event_onaylandi",
  "club_event_planlaniyor",
  "club_event_fikir",
];

export function dominantKind(kinds: EventKind[]): EventKind | null {
  if (kinds.length === 0) return null;
  let best: EventKind = kinds[0];
  let bestRank = DOMINANCE_ORDER.indexOf(best);
  for (const kind of kinds) {
    const rank = DOMINANCE_ORDER.indexOf(kind);
    const effectiveRank = rank === -1 ? DOMINANCE_ORDER.length : rank;
    if (effectiveRank < (bestRank === -1 ? DOMINANCE_ORDER.length : bestRank)) {
      best = kind;
      bestRank = rank;
    }
  }
  return best;
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Görünür ay ızgarasındaki (bitişik ayların taşan günleri dahil) akademik
 * takvim + sınav programı katmanlarını, sol panellerdeki aktif filtrelere göre
 * süzülmüş bar listesi olarak döner.
 *
 * Küçük tablo boyutu (bkz. DECISIONS.md — bir dönem birkaç yüz satır) nedeniyle
 * tarih aralığı ve filtre süzmesi SQL yerine bellekte yapılıyor; sorgu karmaşıklığı
 * gereksiz.
 */
export async function getMonthCalendarBars(
  gridStart: Date,
  gridEnd: Date,
  activeLayers: Set<string>
): Promise<CalendarBarItem[]> {
  const activeCategoryFilters = ["SINAV", "TATIL", "DERS_DONEMI", "KAYIT", "IDARI"].filter((cat) =>
    isLayerActive(activeLayers, makeLayerId("academic-category", cat))
  );
  const activeFaculties = FACULTY_CODES.filter((code) =>
    isLayerActive(activeLayers, makeLayerId("exam-faculty", code))
  );
  const activeTypes = (["arasinav", "final", "mazeret"] as const).filter((type) =>
    isLayerActive(activeLayers, makeLayerId("exam-type", type))
  );

  const [academicRows, examRows] = await Promise.all([
    db.select().from(academicCalendarEntries).where(eq(academicCalendarEntries.isActive, true)),
    db.select().from(examSessions).where(eq(examSessions.isActive, true)),
  ]);

  const bars: CalendarBarItem[] = [];
  const start = toDateOnly(gridStart);
  const end = toDateOnly(gridEnd);

  for (const row of academicRows) {
    const effective = row.categoryOverride ?? row.category;
    if (activeCategoryFilters.length > 0 && !activeCategoryFilters.includes(effective)) continue;

    const rowStart = row.startDate ?? row.endDate;
    const rowEnd = row.endDate ?? row.startDate;
    if (!rowStart || !rowEnd) continue;

    const clippedStart = rowStart < start ? start : toDateOnly(rowStart);
    const clippedEnd = rowEnd > end ? end : toDateOnly(rowEnd);
    if (clippedStart > clippedEnd) continue;

    bars.push({
      id: `academic:${row.id}`,
      label: row.description,
      kind: academicCalendarKindFromCategory(effective),
      startDate: clippedStart,
      endDate: clippedEnd,
    });
  }

  for (const row of examRows) {
    if (!row.examDate) continue;
    if (activeFaculties.length > 0 && !activeFaculties.includes(row.facultyCode as (typeof FACULTY_CODES)[number])) {
      continue;
    }
    if (activeTypes.length > 0 && !activeTypes.includes(row.examType)) continue;

    const date = toDateOnly(row.examDate);
    if (date < start || date > end) continue;

    bars.push({
      id: `exam:${row.id}`,
      label: `${row.courseCode ?? "?"}${row.startTime ? ` ${row.startTime}` : ""}`,
      kind: examTypeKind(row.examType),
      startDate: date,
      endDate: date,
    });
  }

  return bars;
}
