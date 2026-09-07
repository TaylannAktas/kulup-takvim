import "server-only";
import { and, eq, gte, lte, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries, examSessions, clubEvents, courseSessions, dayNotes } from "@/lib/db/schema";
import {
  academicCalendarKindFromCategory,
  examTypeKind,
  clubEventKindFromStatus,
  courseSessionKind,
  type EventKind,
} from "@/lib/calendar/color-system";
import { makeLayerId, isLayerActive } from "@/lib/calendar/layers";
import { FACULTY_CODES } from "@/lib/scrapers/exam-schedule/fetch";
import { toClubTime } from "@/lib/calendar/date-utils";
import { hasAnyConflict, type ConflictFlags } from "@/lib/calendar/conflict-detection";
import { COURSE_LAYER_NAMESPACE } from "@/lib/calendar/course-layers";
import { categoryHiddenLayerId } from "@/lib/calendar/category-layers";
import { formatDateOnly } from "@/lib/calendar/day-notes";

export type CalendarBarItem = {
  id: string;
  label: string;
  kind: EventKind;
  /** Dahil (inclusive), saat bilgisi olmadan gün bazlı. */
  startDate: Date;
  endDate: Date;
  /** Çakışma rozeti gösterilsin mi (spec §6.5 "Çakışma uyarısı — kırmızı ünlem"). */
  hasConflict?: boolean;
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
  "course_session_lab",
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
 * Ders programı katmanları (CourseSchedulePanel'in "Sınıflar/Derslikler/Dersler"
 * sekmelerinden seçimler). Birden fazla katman aynı anda aktif olabilir —
 * kullanıcı birden fazla sınıfın/derslik/dersin programını üst üste
 * görüntüleyebilir; bar üretimi hepsinin oturumlarını birleştirir (bkz. aşağı).
 */
export function parseActiveCourseLayers(
  activeLayers: Set<string>
): Array<{ type: keyof typeof COURSE_LAYER_NAMESPACE; value: string }> {
  const result: Array<{ type: keyof typeof COURSE_LAYER_NAMESPACE; value: string }> = [];
  for (const layer of activeLayers) {
    for (const [type, namespace] of Object.entries(COURSE_LAYER_NAMESPACE)) {
      const prefix = `${namespace}:`;
      if (layer.startsWith(prefix)) {
        result.push({ type: type as keyof typeof COURSE_LAYER_NAMESPACE, value: layer.slice(prefix.length) });
      }
    }
  }
  return result;
}

/** ISO hafta günü (Pazartesi=1 … Pazar=7) — course_sessions.weekday ile aynı kural. */
export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Görünür ay ızgarasındaki (bitişik ayların taşan günleri dahil) akademik
 * takvim + sınav programı katmanlarını, sol panellerdeki aktif filtrelere göre
 * süzülmüş bar listesi olarak döner.
 *
 * Akademik takvim ve kulüp etkinlikleri küçük tablolar (bkz. DECISIONS.md) —
 * onların filtre süzmesi SQL yerine bellekte yapılıyor. `exam_sessions` ise
 * gerçekte binlerce satıra çıkabiliyor (senkron dedup sorunu, bkz. DECISIONS.md
 * "Bilinen veri sorunları"); o yüzden tarih aralığı bu tablo için DB'de
 * filtreleniyor — tüm tabloyu çekip render etmek 20+ saniyeye çıkıyordu.
 */
/** Bir günün akademik takvim kaydı BAŞLANGICI ve/veya BİTİŞİ olabileceğini taşır. */
export type AcademicEdge = { start?: EventKind; end?: EventKind };

export type MonthCalendarData = {
  bars: CalendarBarItem[];
  /**
   * Akademik takvim artık şerit/bar DEĞİL, hücre bazlı dolgu da DEĞİL —
   * sadece kaydın BAŞLADIĞI günün sol kenarına, BİTTİĞİ günün sağ kenarına
   * renkli bir çerçeve (kullanıcı isteği, 2026-09-08). Önceki tasarım
   * (kapsadığı HER günü çerçeveliyordu) bazı kayıtlar 150+ gün sürdüğü için
   * kendi başına kalabalık yaratıyordu — "YYYY-MM-DD" → AcademicEdge eşlemesi.
   */
  academicEdges: Map<string, AcademicEdge>;
  /**
   * Aynı bilginin kapsanan HER günü içeren hâli — ay ızgarası artık bunu
   * KULLANMIYOR (yukarıdaki not), ama dönem ısı haritası (`/calendar/term`)
   * hâlâ tüm dönem boyunca günlük yoğunluk göstermek istiyor, oradaki tek
   * tüketici bu alan.
   */
  academicDayKinds: Map<string, EventKind>;
};

/** Bir günde birden fazla akademik kayıt çakışırsa çerçeve rengi için öncelik. */
const ACADEMIC_FRAME_PRIORITY: EventKind[] = [
  "academic_tatil",
  "academic_ders_donemi",
  "academic_kayit",
  "academic_idari",
];

export async function getMonthCalendarBars(
  gridStart: Date,
  gridEnd: Date,
  activeLayers: Set<string>
): Promise<MonthCalendarData> {
  const activeCategoryFilters = ["SINAV", "TATIL", "DERS_DONEMI", "KAYIT", "IDARI"].filter((cat) =>
    isLayerActive(activeLayers, makeLayerId("academic-category", cat))
  );
  const activeFaculties = FACULTY_CODES.filter((code) =>
    isLayerActive(activeLayers, makeLayerId("exam-faculty", code))
  );
  const activeTypes = (["arasinav", "final", "mazeret"] as const).filter((type) =>
    isLayerActive(activeLayers, makeLayerId("exam-type", type))
  );

  // Sol paneldeki ("Ders Programı"/"Sınav Programı"/"Akademik Takvim") ana tik
  // kutuları — kendi alt filtreleri ne olursa olsun bütün kategoriyi gizler.
  // Boş katman = gizli DEĞİL (bkz. category-layers.ts'teki "hidden" adlandırma
  // gerekçesi): varsayılan olarak üçü de görünür.
  const academicHidden = isLayerActive(activeLayers, categoryHiddenLayerId("academic"));
  const examHidden = isLayerActive(activeLayers, categoryHiddenLayerId("exam"));
  const courseHidden = isLayerActive(activeLayers, categoryHiddenLayerId("course"));

  const bars: CalendarBarItem[] = [];
  const start = toDateOnly(gridStart);
  const end = toDateOnly(gridEnd);

  // exam_sessions binlerce satıra kadar büyüyebiliyor (bkz. DECISIONS.md); ay
  // ızgarasında görünmeyecek satırları belleğe hiç çekmemek için DB'de tarih
  // aralığıyla sınırlıyoruz — önceden tüm tablo çekilip bellekte filtreleniyordu.
  // Kategori gizliyse sorguyu hiç atmıyoruz.
  const [academicRows, examRows, eventRows] = await Promise.all([
    academicHidden
      ? Promise.resolve([])
      : db.select().from(academicCalendarEntries).where(eq(academicCalendarEntries.isActive, true)),
    examHidden
      ? Promise.resolve([])
      : db
          .select()
          .from(examSessions)
          .where(and(eq(examSessions.isActive, true), gte(examSessions.examDate, start), lte(examSessions.examDate, end))),
    db.select().from(clubEvents).where(ne(clubEvents.status, "iptal")),
  ]);

  const academicEdges = new Map<string, AcademicEdge>();
  const academicDayKinds = new Map<string, EventKind>();
  const betterKind = (a: EventKind, b: EventKind | undefined) =>
    !b || ACADEMIC_FRAME_PRIORITY.indexOf(a) < ACADEMIC_FRAME_PRIORITY.indexOf(b);

  for (const row of academicRows) {
    const effective = row.categoryOverride ?? row.category;
    if (activeCategoryFilters.length > 0 && !activeCategoryFilters.includes(effective)) continue;

    const rowStart = row.startDate ?? row.endDate;
    const rowEnd = row.endDate ?? row.startDate;
    if (!rowStart || !rowEnd) continue;

    const rowStartOnly = toDateOnly(rowStart);
    const rowEndOnly = toDateOnly(rowEnd);
    if (rowEndOnly < start || rowStartOnly > end) continue; // görünür ızgaranın tamamen dışında

    const kind = academicCalendarKindFromCategory(effective);

    // Kaydın gerçek başlangıcı görünür ızgarada mı — değilse (ay başından
    // önce başladıysa) bu ayda görünen bir "başlangıç kenarı" yok, kayıt
    // zaten devam ediyor demektir; aynı mantık bitiş için de geçerli.
    if (rowStartOnly >= start && rowStartOnly <= end) {
      const iso = formatDateOnly(rowStartOnly);
      const entry = academicEdges.get(iso) ?? {};
      if (betterKind(kind, entry.start)) entry.start = kind;
      academicEdges.set(iso, entry);
    }
    if (rowEndOnly >= start && rowEndOnly <= end) {
      const iso = formatDateOnly(rowEndOnly);
      const entry = academicEdges.get(iso) ?? {};
      if (betterKind(kind, entry.end)) entry.end = kind;
      academicEdges.set(iso, entry);
    }

    // Dönem ısı haritası için: kapsanan HER gün (bkz. academicDayKinds yorumu).
    const clippedStart = rowStartOnly < start ? start : rowStartOnly;
    const clippedEnd = rowEndOnly > end ? end : rowEndOnly;
    for (let d = new Date(clippedStart); d <= clippedEnd; d.setDate(d.getDate() + 1)) {
      const iso = formatDateOnly(d);
      const existing = academicDayKinds.get(iso);
      if (!existing || betterKind(kind, existing)) academicDayKinds.set(iso, kind);
    }
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

  // Kulüp etkinlikleri sol panelde bir katmanı yok — sidebar filtrelerinden
  // bağımsız olarak her zaman gösterilir (iptal edilenler hariç).
  for (const row of eventRows) {
    // startAt/endAt UTC anları; ay ızgarası Europe/Istanbul takvim gününe
    // göre çizildiği için gösterim öncesi yerel duvar saatine çevriliyor.
    const eventStart = toDateOnly(toClubTime(row.startAt));
    const eventEnd = toDateOnly(toClubTime(row.endAt));

    const clippedStart = eventStart < start ? start : eventStart;
    const clippedEnd = eventEnd > end ? end : eventEnd;
    if (clippedStart > clippedEnd) continue;

    bars.push({
      id: `event:${row.id}`,
      label: row.title,
      kind: clubEventKindFromStatus(row.status),
      startDate: clippedStart,
      endDate: clippedEnd,
      hasConflict: hasAnyConflict((row.conflictFlags as ConflictFlags | null) ?? { exam: [], holiday: [], event: [] }),
    });
  }

  // Ders programı: CourseSchedulePanel'den birden fazla sınıf/derslik/ders
  // aynı anda seçilebilir — hepsinin oturumları birleştirilip (aynı oturum
  // birden fazla seçime uyuyorsa tekilleştirilip) haftalık desenden görünür
  // aralıktaki her tarihe "çoğaltılarak" bara çevrilir (course_sessions
  // belirli bir tarihe değil haftanın gününe bağlıdır — bkz.
  // lib/availability/overlap.ts'teki aynı varsayım).
  const activeCourseLayers = parseActiveCourseLayers(activeLayers);
  if (!courseHidden && activeCourseLayers.length > 0) {
    const filters = activeCourseLayers.map((layer) =>
      layer.type === "import"
        ? eq(courseSessions.importId, layer.value)
        : layer.type === "room"
          ? eq(courseSessions.room, layer.value)
          : eq(courseSessions.courseCode, layer.value)
    );

    const matchedRows = await db
      .select()
      .from(courseSessions)
      .where(filters.length === 1 ? filters[0] : or(...filters));

    const seenSessionIds = new Set<string>();
    const sessionRows = matchedRows.filter((row) =>
      seenSessionIds.has(row.id) ? false : (seenSessionIds.add(row.id), true)
    );

    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const weekday = isoWeekday(day);
      for (const session of sessionRows) {
        if (session.weekday !== weekday) continue;
        const date = toDateOnly(day);
        bars.push({
          // Ay ızgarasında sadece ders KODU gösteriliyor (kullanıcı isteği,
          // 2026-09-07) — ne saat ne de uzun ders adı: küçük hücrede sadece
          // kod (örn. "CHE105") okunaklı kalıyor. Saat ve ad zaten gün
          // ayrıntı çizelgesinde (HourlyTimeline) görünüyor.
          id: `course:${session.id}:${date.toISOString().slice(0, 10)}`,
          label: session.courseCode ?? "?",
          kind: courseSessionKind(session.room),
          startDate: date,
          endDate: date,
        });
      }
    }
  }

  return { bars, academicEdges, academicDayKinds };
}

/**
 * Görünür ay ızgarasında notu olan günlerin "YYYY-MM-DD" kümesi — gün
 * hücresinin sağ üst köşesindeki sarı üçgen işareti için (spec §6.5 "Gün
 * notu | Sarı köşe üçgeni", kullanıcı raporu üzerine eklendi, 2026-09-07;
 * daha önce hiç bağlanmamıştı). Bar listesine dahil değil — bir çubuk değil,
 * hücre başına tek bir işaret olduğu için ayrı, hafif bir sorgu.
 */
export async function getMonthNoteDates(gridStart: Date, gridEnd: Date): Promise<Set<string>> {
  const start = toDateOnly(gridStart);
  const end = toDateOnly(gridEnd);
  const rows = await db
    .select({ date: dayNotes.date })
    .from(dayNotes)
    .where(and(gte(dayNotes.date, start), lte(dayNotes.date, end)));
  return new Set(rows.map((row) => formatDateOnly(row.date)));
}
