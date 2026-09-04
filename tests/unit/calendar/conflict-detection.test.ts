import { describe, it, expect } from "vitest";
import {
  rangesOverlap,
  dayRangesOverlap,
  parseWallClockTime,
  clubWallClockToUtc,
  examSessionToUtcRange,
  academicEntryDayRange,
  clubDayOf,
  computeConflictsFromSources,
  emptyConflictFlags,
  hasAnyConflict,
  type ConflictSources,
} from "@/lib/calendar/conflict-detection";

/**
 * Sürücü davranışını taklit eden yardımcı: Postgres `date` sütunları neon
 * sürücüsünden **süreç yerel saatinin gece yarısı** olarak geliyor
 * (bkz. conflict-detection.ts'teki "Sürücü notu"). Testte de aynı şekilde
 * üretiliyor ki gerçek veriyle aynı yolu doğrulasın.
 */
function dbDate(year: number, month1: number, day: number): Date {
  return new Date(year, month1 - 1, day);
}

/** Europe/Istanbul sabit UTC+3 (Türkiye 2016'dan beri yaz saati uygulamıyor). */
function utc(iso: string): Date {
  return new Date(iso);
}

const EMPTY_SOURCES: ConflictSources = {
  examSessions: [],
  academicEntries: [],
  clubEvents: [],
};

describe("rangesOverlap", () => {
  const a1 = utc("2025-10-31T10:00:00Z");
  const a2 = utc("2025-10-31T12:00:00Z");

  it("kısmi kesişmede true döner", () => {
    expect(rangesOverlap(a1, a2, utc("2025-10-31T11:00:00Z"), utc("2025-10-31T13:00:00Z"))).toBe(true);
    expect(rangesOverlap(a1, a2, utc("2025-10-31T09:00:00Z"), utc("2025-10-31T11:00:00Z"))).toBe(true);
  });

  it("tamamen kapsamada true döner (her iki yönde)", () => {
    expect(rangesOverlap(a1, a2, utc("2025-10-31T10:30:00Z"), utc("2025-10-31T11:00:00Z"))).toBe(true);
    expect(rangesOverlap(a1, a2, utc("2025-10-31T08:00:00Z"), utc("2025-10-31T18:00:00Z"))).toBe(true);
  });

  it("birebir aynı aralıkta true döner", () => {
    expect(rangesOverlap(a1, a2, a1, a2)).toBe(true);
  });

  it("sınırda dokunma çakışma SAYILMAZ (kesin < / >)", () => {
    // Etkinlik 12:00'de bitiyor, sınav 12:00'de başlıyor → çakışma yok.
    expect(rangesOverlap(a1, a2, a2, utc("2025-10-31T14:00:00Z"))).toBe(false);
    // Etkinlik 10:00'da başlıyor, önceki kayıt 10:00'da bitiyor → çakışma yok.
    expect(rangesOverlap(a1, a2, utc("2025-10-31T08:00:00Z"), a1)).toBe(false);
  });

  it("ayrık aralıklarda false döner", () => {
    expect(rangesOverlap(a1, a2, utc("2025-10-31T13:00:00Z"), utc("2025-10-31T14:00:00Z"))).toBe(false);
    expect(rangesOverlap(a1, a2, utc("2025-10-30T13:00:00Z"), utc("2025-10-30T14:00:00Z"))).toBe(false);
  });
});

describe("dayRangesOverlap", () => {
  it("gün aralıklarında uçlar DAHİL sayılır", () => {
    const eventDay = dbDate(2025, 11, 5);
    // 1-5 Kasım tatili, 5 Kasım'daki etkinliği kapsar.
    expect(dayRangesOverlap(eventDay, eventDay, dbDate(2025, 11, 1), dbDate(2025, 11, 5))).toBe(true);
    // 6-8 Kasım tatili kapsamaz.
    expect(dayRangesOverlap(eventDay, eventDay, dbDate(2025, 11, 6), dbDate(2025, 11, 8))).toBe(false);
  });
});

describe("parseWallClockTime", () => {
  it("HH:MM ve Postgres'in HH:MM:SS biçimini kabul eder", () => {
    expect(parseWallClockTime("15:30")).toEqual({ hours: 15, minutes: 30 });
    expect(parseWallClockTime("15:30:00")).toEqual({ hours: 15, minutes: 30 });
    expect(parseWallClockTime(" 9:05 ")).toEqual({ hours: 9, minutes: 5 });
  });

  it("geçersiz girdide null döner", () => {
    expect(parseWallClockTime("15.30")).toBeNull();
    expect(parseWallClockTime("25:00")).toBeNull();
    expect(parseWallClockTime("")).toBeNull();
  });
});

describe("Europe/Istanbul duvar saati → UTC dönüşümü", () => {
  it("31 Ekim 2025 15:30 (TR) → 12:30 UTC — Türkiye sabit UTC+3", () => {
    const instant = clubWallClockToUtc(dbDate(2025, 10, 31), "15:30");
    expect(instant?.toISOString()).toBe("2025-10-31T12:30:00.000Z");
  });

  it("yaz aylarında da +3 kalır (yaz saati YOK, +4'e kaymaz)", () => {
    // Avrupa'nın çoğu 2025-07-15'te DST'de; Türkiye değil.
    const summer = clubWallClockToUtc(dbDate(2025, 7, 15), "09:00");
    expect(summer?.toISOString()).toBe("2025-07-15T06:00:00.000Z");

    const winter = clubWallClockToUtc(dbDate(2025, 1, 15), "09:00");
    expect(winter?.toISOString()).toBe("2025-01-15T06:00:00.000Z");
  });

  it("AB yaz saati geçişinin (26 Ekim 2025) iki yakasında offset değişmez", () => {
    expect(clubWallClockToUtc(dbDate(2025, 10, 25), "12:00")?.toISOString()).toBe(
      "2025-10-25T09:00:00.000Z"
    );
    expect(clubWallClockToUtc(dbDate(2025, 10, 27), "12:00")?.toISOString()).toBe(
      "2025-10-27T09:00:00.000Z"
    );
  });
});

describe("examSessionToUtcRange", () => {
  it("tam bir sınav oturumunu UTC aralığına çevirir", () => {
    const range = examSessionToUtcRange({
      examDate: dbDate(2025, 10, 31),
      startTime: "15:30:00",
      endTime: "17:00:00",
    });
    expect(range?.start.toISOString()).toBe("2025-10-31T12:30:00.000Z");
    expect(range?.end.toISOString()).toBe("2025-10-31T14:00:00.000Z");
  });

  it("eksik tarih/saat veya bozuk aralık için null döner", () => {
    expect(examSessionToUtcRange({ examDate: null, startTime: "15:30", endTime: "17:00" })).toBeNull();
    expect(
      examSessionToUtcRange({ examDate: dbDate(2025, 10, 31), startTime: null, endTime: "17:00" })
    ).toBeNull();
    expect(
      examSessionToUtcRange({ examDate: dbDate(2025, 10, 31), startTime: "17:00", endTime: "15:30" })
    ).toBeNull();
  });
});

describe("academicEntryDayRange", () => {
  it("iki sütun da doluysa aralık döner", () => {
    const range = academicEntryDayRange({
      startDate: dbDate(2025, 11, 1),
      endDate: dbDate(2025, 11, 5),
    });
    expect(range?.start.getDate()).toBe(1);
    expect(range?.end.getDate()).toBe(5);
  });

  it("tek sütun doluysa tek günlük aralık döner (her iki yönde)", () => {
    const onlyStart = academicEntryDayRange({ startDate: dbDate(2025, 10, 29), endDate: null });
    expect(onlyStart?.start.getTime()).toBe(onlyStart?.end.getTime());

    const onlyEnd = academicEntryDayRange({ startDate: null, endDate: dbDate(2026, 7, 3) });
    expect(onlyEnd?.start.getTime()).toBe(onlyEnd?.end.getTime());
  });

  it("iki sütun da boşsa null döner", () => {
    expect(academicEntryDayRange({ startDate: null, endDate: null })).toBeNull();
  });
});

describe("clubDayOf", () => {
  it("UTC anını Europe/Istanbul takvim gününe indirger — gece yarısı sınırı dahil", () => {
    // 31 Ekim 21:30 UTC = 1 Kasım 00:30 TR → gün 1 Kasım olmalı.
    const day = clubDayOf(utc("2025-10-31T21:30:00Z"));
    expect(day.getFullYear()).toBe(2025);
    expect(day.getMonth()).toBe(10); // Kasım
    expect(day.getDate()).toBe(1);
  });
});

describe("computeConflictsFromSources", () => {
  const event = { startAt: utc("2025-10-31T12:00:00Z"), endAt: utc("2025-10-31T14:00:00Z") };

  it("hiçbir kaynak yokken boş ama tam şekilli bir nesne döner", () => {
    const flags = computeConflictsFromSources(event, EMPTY_SOURCES);
    expect(flags).toEqual(emptyConflictFlags());
    expect(Object.keys(flags)).toEqual(["exam", "holiday", "event"]);
    expect(hasAnyConflict(flags)).toBe(false);
  });

  it("kesişen sınav oturumunu exam dizisine, Türkçe açıklamasıyla yazar", () => {
    const flags = computeConflictsFromSources(event, {
      ...EMPTY_SOURCES,
      examSessions: [
        {
          id: "e1",
          courseCode: "AE111",
          courseName: "Havacılığa Giriş",
          examDate: dbDate(2025, 10, 31),
          startTime: "15:30",
          endTime: "17:00",
        },
      ],
    });
    expect(flags.exam).toHaveLength(1);
    expect(flags.exam[0].label).toBe("AE111");
    expect(flags.exam[0].detail).toBe("31 Ekim 2025 15:30 AE111 sınavı");
  });

  it("sınırda dokunan sınavı çakışma saymaz", () => {
    // Etkinlik 14:00 UTC (17:00 TR) bitiyor; sınav 17:00 TR'de başlıyor.
    const flags = computeConflictsFromSources(event, {
      ...EMPTY_SOURCES,
      examSessions: [
        {
          id: "e1",
          courseCode: "AE111",
          courseName: null,
          examDate: dbDate(2025, 10, 31),
          startTime: "17:00",
          endTime: "19:00",
        },
      ],
    });
    expect(flags.exam).toHaveLength(0);
  });

  it("TATIL → holiday, akademik takvimin SINAV kaydı → exam", () => {
    const flags = computeConflictsFromSources(event, {
      ...EMPTY_SOURCES,
      academicEntries: [
        {
          id: "a1",
          description: "Cumhuriyet Bayramı",
          category: "TATIL",
          categoryOverride: null,
          startDate: dbDate(2025, 10, 29),
          endDate: dbDate(2025, 11, 2),
        },
        {
          id: "a2",
          description: "Ara sınavlar",
          category: "SINAV",
          categoryOverride: null,
          startDate: dbDate(2025, 10, 31),
          endDate: null,
        },
        {
          id: "a3",
          description: "Güz dönemi dersleri",
          category: "DERS_DONEMI",
          categoryOverride: null,
          startDate: dbDate(2025, 9, 15),
          endDate: dbDate(2026, 1, 10),
        },
      ],
    });
    expect(flags.holiday.map((c) => c.id)).toEqual(["a1"]);
    expect(flags.holiday[0].detail).toBe("Cumhuriyet Bayramı");
    expect(flags.exam.map((c) => c.id)).toEqual(["a2"]);
    // DERS_DONEMI çakışma üretmez (yılın çoğunu kaplar).
    expect(flags.exam).toHaveLength(1);
  });

  it("categoryOverride etkin kategoriyi belirler", () => {
    const flags = computeConflictsFromSources(event, {
      ...EMPTY_SOURCES,
      academicEntries: [
        {
          id: "a1",
          description: "Elle tatile çevrilmiş kayıt",
          category: "IDARI",
          categoryOverride: "TATIL",
          startDate: dbDate(2025, 10, 31),
          endDate: dbDate(2025, 10, 31),
        },
      ],
    });
    expect(flags.holiday).toHaveLength(1);
  });

  it("diğer kulüp etkinliklerini event dizisine yazar, kendisini hariç tutar", () => {
    const sources: ConflictSources = {
      ...EMPTY_SOURCES,
      clubEvents: [
        { id: "self", title: "Düzenlenen etkinlik", startAt: event.startAt, endAt: event.endAt },
        {
          id: "other",
          title: "Tanışma Toplantısı",
          startAt: utc("2025-10-31T13:00:00Z"),
          endAt: utc("2025-10-31T15:00:00Z"),
        },
      ],
    };

    const withSelf = computeConflictsFromSources(event, sources);
    expect(withSelf.event.map((c) => c.id).sort()).toEqual(["other", "self"]);

    const excluded = computeConflictsFromSources(event, sources, "self");
    expect(excluded.event.map((c) => c.id)).toEqual(["other"]);
    expect(excluded.event[0].label).toBe("Tanışma Toplantısı");
    expect(excluded.event[0].detail).toBe("31 Ekim 2025 16:00–18:00 Tanışma Toplantısı");
  });
});
