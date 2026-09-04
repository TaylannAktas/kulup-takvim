import "server-only";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries, clubEvents, examSessions } from "@/lib/db/schema";
import { toClubTime, fromClubTime } from "@/lib/calendar/date-utils";

/**
 * Çakışma tespiti (spesifikasyon §4.5). Bir kulüp etkinliğinin zaman aralığı
 * sınav programı, akademik takvim ve diğer kulüp etkinlikleriyle karşılaştırılır;
 * sonuç `club_events.conflict_flags` jsonb sütununa olduğu gibi yazılır.
 *
 * ---------------------------------------------------------------------------
 * SAAT DİLİMİ KURALI (spec §3, kabul kriteri §11)
 * ---------------------------------------------------------------------------
 * `club_events.start_at/end_at` timestamptz (yani gerçek bir UTC anı).
 * `exam_sessions.exam_date/start_time/end_time` ve
 * `academic_calendar_entries.start_date/end_date` ise üniversitenin sayfasında
 * yazdığı gibi **Europe/Istanbul duvar saati** değerleri — içlerinde saat dilimi
 * bilgisi yok.
 *
 * Seçilen tek tip yaklaşım: *duvar saatli kaynakları UTC anına yükseltmek*
 * (`fromClubTime`), sonra iki tarafı da UTC anı olarak karşılaştırmak. Tersi
 * (etkinliği duvar saatine indirmek) de çalışırdı ama karşılaştırılan iki
 * değerden birini "sahte" bir Date'e çevirmek gerektiği için hata yapmaya
 * daha açık.
 *
 * Türkiye 2016'dan beri yaz saati uygulamıyor; sabit UTC+3. Yine de offset'i
 * elle +3 varsaymıyoruz — `date-fns-tz` üzerinden IANA veritabanına soruyoruz
 * ki eski tarihler (2016 öncesi arşiv verisi) ve olası bir mevzuat değişikliği
 * kendiliğinden doğru çalışsın.
 *
 * Sürücü notu: Postgres `date` sütunları (`mode: "date"`) neon sürücüsünden
 * **süreç yerel saatinin gece yarısı** olarak geliyor (ör. TS'de "2025-10-31"
 * → 2025-10-30T21:00Z). Yani takvim günü yerel getter'larla (`getFullYear`,
 * `getMonth`, `getDate`) okunmalı — UTC getter'larıyla değil. Bu, depodaki
 * mevcut desenle aynı (bkz. `lib/calendar/day-detail.ts`, `month-events.ts`).
 *
 * ---------------------------------------------------------------------------
 * SINIR KURALI
 * ---------------------------------------------------------------------------
 * Sadece dokunan aralıklar çakışma SAYILMAZ: 14:00–16:00 biten bir etkinlik
 * 16:00'da başlayan bir sınavla çakışmaz. Bu yüzden zaman karşılaştırmalarında
 * kesin `<` / `>` kullanılıyor. Tüm gün süren (tarih bazlı) akademik takvim
 * kayıtlarında ise gün aralıkları kapsayıcı (`<=`) — "1-5 Kasım tatili" 5 Kasım'ı
 * da içerir.
 *
 * ---------------------------------------------------------------------------
 * KATEGORİ KARARI
 * ---------------------------------------------------------------------------
 * Akademik takvimin `TATIL` kayıtları `holiday`, `SINAV` kayıtları ise
 * `exam` dizisine gidiyor. Gerekçe: kullanıcı için anlam "bir sınav dönemi
 * sürüyor" — kaynağın hangi tablo olduğu değil. `exam_sessions` tek tek sınav
 * oturumlarını (AE111, 31 Ekim 15:30), akademik takvimin SINAV kayıtları ise
 * geniş dönemleri ("Final sınavları", 5-16 Ocak) temsil eder; ikisi de aynı
 * uyarı kutusunda görünmeli. Diğer kategoriler (DERS_DONEMI, KAYIT, IDARI)
 * çakışma üretmez — ders dönemi zaten yılın çoğunu kaplar, uyarı gürültüsü olur.
 */

export type ConflictEntry = {
  /** Çakışan kaydın kendi id'si (exam_sessions / academic_calendar_entries / club_events). */
  id: string;
  /** Kısa etiket — rozet/çip içinde gösterilebilecek uzunlukta. */
  label: string;
  /** İnsan okuyacak Türkçe açıklama parçası. */
  detail: string;
};

export type ConflictFlags = {
  exam: ConflictEntry[];
  holiday: ConflictEntry[];
  event: ConflictEntry[];
};

export function emptyConflictFlags(): ConflictFlags {
  return { exam: [], holiday: [], event: [] };
}

export function hasAnyConflict(flags: ConflictFlags): boolean {
  return flags.exam.length > 0 || flags.holiday.length > 0 || flags.event.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Saf yardımcılar (veritabanına dokunmaz — testler bunları doğrudan çağırır)  */
/* -------------------------------------------------------------------------- */

/**
 * İki zaman aralığı kesişiyor mu? Sınırda dokunma çakışma sayılmaz
 * (bkz. yukarıdaki "SINIR KURALI").
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * İki *gün* aralığı kesişiyor mu? Tüm gün süren kayıtlar için, iki uç da dahil.
 */
export function dayRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

/**
 * "15:30", "15:30:00" veya "9:05" biçimindeki duvar saatini bileşenlerine ayırır.
 * Postgres `time` sütunu sürücüden "HH:MM:SS" olarak geldiği için saniyeli
 * biçim de kabul ediliyor (saniye yok sayılıyor — sınav saatleri dakika hassas).
 */
export function parseWallClockTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Bir `date` sütunundan gelen Date'in takvim gününü (yerel bileşenler) + bir
 * duvar saatini birleştirip Europe/Istanbul'da o ana karşılık gelen UTC anını döner.
 */
export function clubWallClockToUtc(dateOnly: Date, time: string): Date | null {
  const parsed = parseWallClockTime(time);
  if (!parsed) return null;
  const wall = new Date(
    dateOnly.getFullYear(),
    dateOnly.getMonth(),
    dateOnly.getDate(),
    parsed.hours,
    parsed.minutes,
    0,
    0
  );
  return fromClubTime(wall);
}

export type ExamSessionLike = {
  examDate: Date | null;
  startTime: string | null;
  endTime: string | null;
};

/**
 * Bir sınav oturumunu UTC anı aralığına çevirir. Tarih/saat eksikse veya
 * bitiş başlangıçtan sonra değilse (bozuk kaynak verisi) `null` döner —
 * çakışma hesabından sessizce düşer.
 */
export function examSessionToUtcRange(session: ExamSessionLike): { start: Date; end: Date } | null {
  const { examDate, startTime, endTime } = session;
  if (!examDate || !startTime || !endTime) return null;
  const start = clubWallClockToUtc(examDate, startTime);
  const end = clubWallClockToUtc(examDate, endTime);
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

/** Bir `date` sütunu Date'ini saat bileşeni sıfırlanmış "sadece gün"e indirger. */
export function toDayOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** Bir UTC anının Europe/Istanbul'daki takvim gününü (00:00) döner. */
export function clubDayOf(instant: Date): Date {
  const zoned = toClubTime(instant);
  return new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate());
}

/**
 * Akademik takvim kaydının gün aralığı. Tek günlük kayıtlarda iki sütundan
 * hangisi doluysa o kullanılır (bkz. DECISIONS.md — kaynakta başlangıç veya
 * bitiş boş olabiliyor); ikisi de boşsa `null`.
 */
export function academicEntryDayRange(entry: {
  startDate: Date | null;
  endDate: Date | null;
}): { start: Date; end: Date } | null {
  const rawStart = entry.startDate ?? entry.endDate;
  const rawEnd = entry.endDate ?? entry.startDate;
  if (!rawStart || !rawEnd) return null;
  const start = toDayOnly(rawStart);
  const end = toDayOnly(rawEnd);
  if (end.getTime() < start.getTime()) return null;
  return { start, end };
}

function formatClubDate(instant: Date): string {
  return format(toClubTime(instant), "d MMMM yyyy", { locale: tr });
}

function formatClubTime(instant: Date): string {
  return format(toClubTime(instant), "HH:mm", { locale: tr });
}

/* -------------------------------------------------------------------------- */
/* Kaynak verisi üzerinden hesaplama (yine saf — DB erişimi çağıranda)          */
/* -------------------------------------------------------------------------- */

export type ConflictSources = {
  examSessions: Array<{
    id: string;
    courseCode: string | null;
    courseName: string | null;
    examDate: Date | null;
    startTime: string | null;
    endTime: string | null;
  }>;
  academicEntries: Array<{
    id: string;
    description: string;
    category: string;
    categoryOverride: string | null;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  clubEvents: Array<{
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
  }>;
};

export function computeConflictsFromSources(
  event: { startAt: Date; endAt: Date },
  sources: ConflictSources,
  excludeEventId?: string
): ConflictFlags {
  const flags = emptyConflictFlags();

  const eventDayStart = clubDayOf(event.startAt);
  const eventDayEnd = clubDayOf(event.endAt);

  for (const session of sources.examSessions) {
    const range = examSessionToUtcRange(session);
    if (!range) continue;
    if (!rangesOverlap(event.startAt, event.endAt, range.start, range.end)) continue;

    const label = session.courseCode ?? session.courseName ?? "Sınav";
    flags.exam.push({
      id: session.id,
      label,
      detail: `${formatClubDate(range.start)} ${formatClubTime(range.start)} ${label} sınavı`,
    });
  }

  for (const entry of sources.academicEntries) {
    const effectiveCategory = entry.categoryOverride ?? entry.category;
    if (effectiveCategory !== "TATIL" && effectiveCategory !== "SINAV") continue;

    const range = academicEntryDayRange(entry);
    if (!range) continue;
    if (!dayRangesOverlap(eventDayStart, eventDayEnd, range.start, range.end)) continue;

    const target = effectiveCategory === "TATIL" ? flags.holiday : flags.exam;
    target.push({
      id: entry.id,
      label: effectiveCategory,
      detail: entry.description,
    });
  }

  for (const other of sources.clubEvents) {
    if (excludeEventId && other.id === excludeEventId) continue;
    if (!rangesOverlap(event.startAt, event.endAt, other.startAt, other.endAt)) continue;

    flags.event.push({
      id: other.id,
      label: other.title,
      detail: `${formatClubDate(other.startAt)} ${formatClubTime(other.startAt)}–${formatClubTime(
        other.endAt
      )} ${other.title}`,
    });
  }

  return flags;
}

/* -------------------------------------------------------------------------- */
/* Veritabanı erişimi                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Çakışma hesabı için gereken üç tabloyu bir kerede yükler. Tablolar küçük
 * (bkz. DECISIONS.md — bir dönem birkaç yüz satır), bu yüzden tarih süzmesi
 * SQL yerine bellekte yapılıyor; `month-events.ts` ile aynı gerekçe.
 */
export async function loadConflictSources(): Promise<ConflictSources> {
  const [examRows, academicRows, eventRows] = await Promise.all([
    db
      .select({
        id: examSessions.id,
        courseCode: examSessions.courseCode,
        courseName: examSessions.courseName,
        examDate: examSessions.examDate,
        startTime: examSessions.startTime,
        endTime: examSessions.endTime,
      })
      .from(examSessions)
      .where(eq(examSessions.isActive, true)),
    db
      .select({
        id: academicCalendarEntries.id,
        description: academicCalendarEntries.description,
        category: academicCalendarEntries.category,
        categoryOverride: academicCalendarEntries.categoryOverride,
        startDate: academicCalendarEntries.startDate,
        endDate: academicCalendarEntries.endDate,
      })
      .from(academicCalendarEntries)
      .where(eq(academicCalendarEntries.isActive, true)),
    db
      .select({
        id: clubEvents.id,
        title: clubEvents.title,
        startAt: clubEvents.startAt,
        endAt: clubEvents.endAt,
      })
      .from(clubEvents)
      .where(ne(clubEvents.status, "iptal")),
  ]);

  return { examSessions: examRows, academicEntries: academicRows, clubEvents: eventRows };
}

/**
 * Tek bir etkinlik için çakışmaları hesaplar. `excludeEventId` verilirse o
 * etkinlik "diğer etkinlikler" listesinden çıkarılır (güncellenen kayıt kendisiyle
 * çakışmamalı).
 */
export async function computeConflicts(
  event: { startAt: Date; endAt: Date },
  excludeEventId?: string
): Promise<ConflictFlags> {
  const sources = await loadConflictSources();
  return computeConflictsFromSources(event, sources, excludeEventId);
}

/**
 * Okul bir sınav tarihini değiştirdiğinde "dün sorunsuz olan etkinlik bugün
 * uyarı gösteriyor" davranışını üreten fonksiyon (spec §4.5). Her iki senkron
 * cron'unun sonunda çağrılır.
 *
 * Sadece iptal edilmemiş ve bitişi geçmemiş etkinlikler yeniden hesaplanır;
 * geçmiş etkinliğin çakışma uyarısını güncellemenin bir değeri yok.
 *
 * `updated_at` bilerek DOKUNULMUYOR: o alan iyimser kilit jetonu olarak
 * kullanılıyor (spec §7.4). Cron'un onu ilerletmesi, hiçbir insan bir şey
 * değiştirmediği halde açık formların "bu kayıt siz düzenlerken değişti"
 * hatası almasına yol açardı.
 */
export async function recomputeAllActiveEventConflicts(): Promise<{
  checked: number;
  changed: number;
}> {
  const sources = await loadConflictSources();
  const now = new Date();

  const rows = await db
    .select({
      id: clubEvents.id,
      startAt: clubEvents.startAt,
      endAt: clubEvents.endAt,
      conflictFlags: clubEvents.conflictFlags,
    })
    .from(clubEvents)
    .where(and(ne(clubEvents.status, "iptal"), gte(clubEvents.endAt, now)));

  let changed = 0;

  for (const row of rows) {
    const next = computeConflictsFromSources(
      { startAt: row.startAt, endAt: row.endAt },
      sources,
      row.id
    );

    // Veri kümesi küçük; derin karşılaştırma yerine JSON dizesi karşılaştırması
    // yeterli (anahtar sırası her iki tarafta da emptyConflictFlags() sırası).
    if (JSON.stringify(next) === JSON.stringify(row.conflictFlags)) continue;

    await db.update(clubEvents).set({ conflictFlags: next }).where(eq(clubEvents.id, row.id));
    changed += 1;
  }

  return { checked: rows.length, changed };
}
