/**
 * Uygunluk analizi (spec §7.2): seçilen kitlenin (üyeler/hedef kitle/ikisi)
 * haftalık ders programına göre hangi gün×saat dilimlerinde kaç kişinin boş
 * olduğunu hesaplar.
 *
 * Kapsam notu: `course_sessions` dönem boyu tekrar eden haftalık bir
 * desendir (belirli bir tarihe değil haftanın gününe bağlı) — bu modül o
 * haftalık deseni hesaplar. Belirli bir tarih aralığındaki sınav/tatil
 * günlerinin elenmesi ("Sınav ve tatil günleri otomatik elenir") çağıran
 * tarafın (uygunluk analizi sayfası) akademik takvimle kesiştirerek
 * yapması gereken ayrı bir adımdır — bu saf fonksiyon haftalık deseni
 * bilir, takvim tarihlerini bilmez.
 *
 * Saf/test edilebilir: DB erişimi yok, veri çağıran tarafından veriliyor.
 */

export type AvailabilityMember = {
  id: string;
  displayName: string;
  courseCodes: string[] | null;
};

export type AvailabilityCourseSession = {
  courseCode: string | null;
  weekday: number | null; // 1 (Pzt) - 6 (Cmt)
  startTime: string | null; // "HH:MM" veya "HH:MM:SS"
  endTime: string | null;
};

export type AvailabilityInput = {
  members: AvailabilityMember[];
  sessions: AvailabilityCourseSession[];
  dayStartMinutes: number; // örn 8*60
  dayEndMinutes: number; // örn 22*60
  slotMinutes: number; // örn 30
};

export type AvailabilitySlot = {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  freeCount: number;
  totalCount: number;
  freeMemberIds: string[];
};

function parseMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Her üye için, hangi gün×dakika aralıklarında derste olduğunu (busy)
 * `courseCodes` üzerinden `sessions`'a bakarak çıkarır.
 */
function buildBusyIntervals(
  members: AvailabilityMember[],
  sessions: AvailabilityCourseSession[]
): Map<string, Array<{ weekday: number; start: number; end: number }>> {
  const sessionsByCourse = new Map<string, AvailabilityCourseSession[]>();
  for (const session of sessions) {
    if (!session.courseCode || !session.weekday || !session.startTime || !session.endTime) continue;
    const key = session.courseCode.trim().toUpperCase();
    if (!sessionsByCourse.has(key)) sessionsByCourse.set(key, []);
    sessionsByCourse.get(key)!.push(session);
  }

  const busyByMember = new Map<string, Array<{ weekday: number; start: number; end: number }>>();

  for (const member of members) {
    const intervals: Array<{ weekday: number; start: number; end: number }> = [];
    for (const rawCode of member.courseCodes ?? []) {
      const matches = sessionsByCourse.get(rawCode.trim().toUpperCase());
      if (!matches) continue;
      for (const session of matches) {
        const start = parseMinutes(session.startTime!);
        const end = parseMinutes(session.endTime!);
        if (start === null || end === null || end <= start) continue;
        intervals.push({ weekday: session.weekday!, start, end });
      }
    }
    busyByMember.set(member.id, intervals);
  }

  return busyByMember;
}

/** Bir üyenin belirli bir gün/dakika aralığında derste olup olmadığı. */
function isBusy(
  intervals: Array<{ weekday: number; start: number; end: number }>,
  weekday: number,
  slotStart: number,
  slotEnd: number
): boolean {
  return intervals.some(
    (interval) => interval.weekday === weekday && interval.start < slotEnd && slotStart < interval.end
  );
}

/**
 * Pazartesi(1)-Cumartesi(6) için `dayStartMinutes`-`dayEndMinutes` aralığını
 * `slotMinutes` dilimlere böler ve her dilimde kaç üyenin boş olduğunu hesaplar.
 */
export function computeWeeklyAvailability(input: AvailabilityInput): AvailabilitySlot[] {
  const { members, sessions, dayStartMinutes, dayEndMinutes, slotMinutes } = input;
  const busyByMember = buildBusyIntervals(members, sessions);
  const slots: AvailabilitySlot[] = [];

  for (let weekday = 1; weekday <= 6; weekday++) {
    for (let start = dayStartMinutes; start < dayEndMinutes; start += slotMinutes) {
      const end = Math.min(start + slotMinutes, dayEndMinutes);
      const freeMemberIds = members
        .filter((member) => !isBusy(busyByMember.get(member.id) ?? [], weekday, start, end))
        .map((member) => member.id);

      slots.push({
        weekday,
        startMinutes: start,
        endMinutes: end,
        freeCount: freeMemberIds.length,
        totalCount: members.length,
        freeMemberIds,
      });
    }
  }

  return slots;
}

/**
 * Verilen süre boyunca (dakika) en uygun (en yüksek boş oranlı) ardışık
 * dilim gruplarını bulur — spec'in "en uygun zaman aralıkları... sıralı"
 * çıktısı için. `durationMinutes`, `slotMinutes`'ın katı olmak zorunda değil;
 * kapsanan son dilim kısmi de olsa dahil edilir.
 */
export function findBestWindows(
  slots: AvailabilitySlot[],
  durationMinutes: number,
  slotMinutes: number,
  topN = 10
): Array<{ weekday: number; startMinutes: number; endMinutes: number; averageFreeRatio: number }> {
  const slotsNeeded = Math.max(1, Math.ceil(durationMinutes / slotMinutes));
  const byWeekday = new Map<number, AvailabilitySlot[]>();
  for (const slot of slots) {
    if (!byWeekday.has(slot.weekday)) byWeekday.set(slot.weekday, []);
    byWeekday.get(slot.weekday)!.push(slot);
  }

  const windows: Array<{ weekday: number; startMinutes: number; endMinutes: number; averageFreeRatio: number }> = [];

  for (const [weekday, daySlots] of byWeekday) {
    daySlots.sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 0; i + slotsNeeded <= daySlots.length; i++) {
      const window = daySlots.slice(i, i + slotsNeeded);
      const isContiguous = window.every(
        (slot, idx) => idx === 0 || slot.startMinutes === window[idx - 1].endMinutes
      );
      if (!isContiguous) continue;

      const total = window[0].totalCount || 1;
      const averageFreeRatio =
        window.reduce((sum, slot) => sum + slot.freeCount / total, 0) / window.length;

      windows.push({
        weekday,
        startMinutes: window[0].startMinutes,
        endMinutes: window[window.length - 1].endMinutes,
        averageFreeRatio,
      });
    }
  }

  return windows.sort((a, b) => b.averageFreeRatio - a.averageFreeRatio).slice(0, topN);
}
