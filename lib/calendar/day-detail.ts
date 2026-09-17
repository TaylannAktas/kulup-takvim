import "server-only";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries, examSessions, clubEvents, courseSessions, timetableImports, dayNotes } from "@/lib/db/schema";
import {
  examTypeKind,
  clubEventKindFromStatus,
  courseSessionKind,
  academicCalendarKindFromCategory,
  type EventKind,
} from "@/lib/calendar/color-system";
import { toClubTime } from "@/lib/calendar/date-utils";
import { isLayerActive } from "@/lib/calendar/layers";
import { categoryHiddenLayerId } from "@/lib/calendar/category-layers";
import { parseActiveCourseLayers, isoWeekday } from "@/lib/calendar/month-events";
import { DEFAULT_PERIODS } from "@/lib/calendar/default-periods";
import { groupSessions, groupTimelineLabel, describeGroupRows } from "@/lib/calendar/grouping";
import type { ParsedPeriod } from "@/lib/timetable-import/parse-svg-timetable";
import type { TimelineItem, TimelinePeriod } from "@/components/calendar/HourlyTimeline";

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
  affectingAcademicEntries: Array<{ id: string; description: string; category: string; kind: EventKind }>;
  summaryText: string;
  /**
   * O gün görünen ders oturumlarının ait olduğu içe aktarma(lar)dan gelen
   * gerçek "ders saati" (period) sınırları — çizelgeyi okulun sitesindeki
   * gibi bölmek için (bkz. HourlyTimeline). Bilinen period yoksa (ders
   * programı katmanı seçili değil, ya da bu sütun eklenmeden önce yapılmış
   * eski bir içe aktarma) boş dizi — çizelge genel saat ızgarasına düşer.
   */
  periods: TimelinePeriod[];
  /** O güne iliştirilmiş serbest notlar (spec §4.4 "day_notes") — sağdaki Notlar paneli için. */
  notes: Array<{ id: string; body: string }>;
};

/**
 * Gün ayrıntı paneli için tek bir günün verisi (spec §6.5).
 *
 * Ders oturumları (Faz 4'ten beri var, ama bu fonksiyon o zaman güncellenmemiş
 * kalmıştı — kullanıcı raporu üzerine eklendi, 2026-09-07): course_sessions
 * belirli bir tarihe değil haftanın gününe bağlı olduğu için, ay ızgarasındaki
 * bar üretimiyle (`getMonthCalendarBars`) AYNI aktif katman/filtre mantığı
 * kullanılıyor (`parseActiveCourseLayers`) — takvimde görünen katmanlarla gün
 * ayrıntısında görünenler tutarsız olmasın diye.
 */
export async function getDayDetail(date: Date, activeLayers: Set<string> = new Set()): Promise<DayDetail> {
  const day = toDateOnly(date);

  // Sol paneldeki ana tik kutuları (bkz. category-layers.ts) burada da
  // uygulanıyor — "sadece sınav programını görebilelim" gün ayrıntısı için de
  // geçerli olsun diye.
  const academicHidden = isLayerActive(activeLayers, categoryHiddenLayerId("academic"));
  const examHidden = isLayerActive(activeLayers, categoryHiddenLayerId("exam"));
  const courseHidden = isLayerActive(activeLayers, categoryHiddenLayerId("course"));
  const activeCourseLayers = parseActiveCourseLayers(activeLayers);

  const courseFilters = activeCourseLayers.map((layer) =>
    layer.type === "import"
      ? eq(courseSessions.importId, layer.value)
      : layer.type === "room"
        ? eq(courseSessions.room, layer.value)
        : eq(courseSessions.courseCode, layer.value)
  );

  // exam_sessions binlerce satıra kadar büyüyebiliyor (bkz. DECISIONS.md); tek
  // günün ayrıntısı için tüm tabloyu çekmek yerine DB'de o güne sınırlıyoruz.
  const [academicRows, examRows, eventRows, matchedCourseRows, noteRows] = await Promise.all([
    academicHidden
      ? Promise.resolve([])
      : db.select().from(academicCalendarEntries).where(eq(academicCalendarEntries.isActive, true)),
    examHidden
      ? Promise.resolve([])
      : db
          .select()
          .from(examSessions)
          .where(and(eq(examSessions.isActive, true), eq(examSessions.examDate, day))),
    db.select().from(clubEvents).where(ne(clubEvents.status, "iptal")),
    courseHidden || courseFilters.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(courseSessions)
          .where(courseFilters.length === 1 ? courseFilters[0] : or(...courseFilters)),
    db.select().from(dayNotes).where(eq(dayNotes.date, day)),
  ]);

  // Aynı oturum birden fazla seçili katmana uyabiliyor (ör. bir sınıf + o
  // sınıfın kullandığı bir derslik aynı anda seçiliyse) — tekilleştiriyoruz,
  // aynen getMonthCalendarBars'taki gibi.
  const seenCourseSessionIds = new Set<string>();
  const dayWeekday = isoWeekday(day);
  const dayCourseSessions = matchedCourseRows.filter((row) => {
    if (row.weekday !== dayWeekday) return false;
    if (seenCourseSessionIds.has(row.id)) return false;
    seenCourseSessionIds.add(row.id);
    return true;
  });

  // O gün görünen oturumların ait olduğu içe aktarma(lar)dan gerçek period
  // sınırlarını çek. Birden fazla içe aktarma aynı anda seçiliyse (farklı
  // sınıflar) period setleri aynı olmasa bile aynı saat/etikete sahip
  // period'lar tekilleştirilip birleştiriliyor.
  const courseImportIds = [
    ...new Set(dayCourseSessions.map((row) => row.importId).filter((id): id is string => !!id)),
  ];
  const periodSourceRows =
    courseImportIds.length > 0
      ? await db
          .select({ periods: timetableImports.periods })
          .from(timetableImports)
          .where(inArray(timetableImports.id, courseImportIds))
      : [];

  const periodByKey = new Map<string, TimelinePeriod>();
  for (const row of periodSourceRows) {
    const rowPeriods = (row.periods as ParsedPeriod[] | null) ?? [];
    for (const period of rowPeriods) {
      const key = `${period.startTime}-${period.endTime}`;
      if (periodByKey.has(key)) continue;
      periodByKey.set(key, {
        startMinutes: timeToMinutes(period.startTime),
        endMinutes: timeToMinutes(period.endTime),
        label: period.rawLabel,
      });
    }
  }
  // Gerçek period verisi (bu içe aktarma bu özellikten sonra yapıldıysa) yoksa
  // sabit koda gömülü listeye düş — kullanıcı isteğiyle (2026-09-07), çizelge
  // her zaman "okulun sitesindeki gibi" bölünmüş görünsün diye (bkz.
  // default-periods.ts). Ders programı katmanı hiç seçili değilse de aynı
  // sabit liste kullanılır — sınav/etkinlikleri hangi ders saatine denk
  // geldiğini görmek için de faydalı.
  const realPeriods = [...periodByKey.values()].sort((a, b) => a.startMinutes - b.startMinutes);
  const periods = realPeriods.length > 0 ? realPeriods : DEFAULT_PERIODS;

  const affectingAcademicEntries = academicRows
    .filter((row) => {
      const start = row.startDate ?? row.endDate;
      const end = row.endDate ?? row.startDate;
      if (!start || !end) return false;
      return toDateOnly(start) <= day && day <= toDateOnly(end);
    })
    .map((row) => {
      const effective = row.categoryOverride ?? row.category;
      return {
        id: row.id,
        description: row.description,
        category: effective,
        kind: academicCalendarKindFromCategory(effective),
      };
    });

  const dayExams = examRows.filter((row) => row.examDate && toDateOnly(row.examDate).getTime() === day.getTime());

  const dayEvents = eventRows.filter((row) => {
    const start = toDateOnly(toClubTime(row.startAt));
    const end = toDateOnly(toClubTime(row.endAt));
    return start <= day && day <= end;
  });

  // Aynı ders + saat + türün salon/şube satırları tek öğede toplanıyor
  // (kullanıcı isteği, 2026-09-17 — bkz. lib/calendar/grouping.ts); döküm hover'da.
  const examGroups = groupSessions(dayExams, (row) => row.examType);
  const examItems: TimelineItem[] = examGroups
    .filter((g) => g.startTime && g.endTime)
    .map((g) => ({
      id: `exam:${g.rows[0].id}`,
      label: groupTimelineLabel(g, "salon"),
      kind: examTypeKind(g.rows[0].examType),
      group: "exam" as const,
      startMinutes: timeToMinutes(g.startTime!),
      endMinutes: timeToMinutes(g.endTime!),
      detail: g.rows.length > 1 ? describeGroupRows(g) : undefined,
    }));

  const eventItems: TimelineItem[] = dayEvents
    .filter((row) => !row.isAllDay)
    .map((row) => ({
      id: `event:${row.id}`,
      label: row.title,
      kind: clubEventKindFromStatus(row.status),
      group: "event" as const,
      startMinutes: clubMinutesOfDay(row.startAt),
      endMinutes: clubMinutesOfDay(row.endAt),
    }));

  const courseGroups = groupSessions(dayCourseSessions);
  const courseItems: TimelineItem[] = courseGroups
    .filter((g) => g.startTime && g.endTime)
    .map((g) => ({
      id: `course:${g.rows[0].id}`,
      label: groupTimelineLabel(g, "şube"),
      kind: courseSessionKind(g.rows[0].room),
      group: "course" as const,
      startMinutes: timeToMinutes(g.startTime!),
      endMinutes: timeToMinutes(g.endTime!),
      detail: g.rows.length > 1 ? describeGroupRows(g) : undefined,
    }));

  const items = [...examItems, ...courseItems, ...eventItems];

  const summaryParts: string[] = [];
  if (examGroups.length > 0) summaryParts.push(`${examGroups.length} sınav`);
  if (courseGroups.length > 0) summaryParts.push(`${courseGroups.length} ders`);
  if (dayEvents.length > 0) summaryParts.push(`${dayEvents.length} etkinlik`);
  const summaryText =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : affectingAcademicEntries.length > 0
        ? "Akademik takvim kaydı var"
        : "Boş gün";

  const notes = noteRows.map((row) => ({ id: row.id, body: row.body }));

  return { items, affectingAcademicEntries, summaryText, periods, notes };
}
