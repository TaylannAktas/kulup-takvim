import { describe, it, expect } from "vitest";
import { computeWeeklyAvailability, findBestWindows } from "@/lib/availability/overlap";

describe("computeWeeklyAvailability", () => {
  it("marks a member busy only during their course's exact weekday/time", () => {
    const slots = computeWeeklyAvailability({
      members: [{ id: "m1", displayName: "A", courseCodes: ["CS101"] }],
      sessions: [{ courseCode: "CS101", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 12 * 60,
      slotMinutes: 60,
    });

    const monday9to10 = slots.find((s) => s.weekday === 1 && s.startMinutes === 9 * 60)!;
    expect(monday9to10.freeCount).toBe(0);

    const monday8to9 = slots.find((s) => s.weekday === 1 && s.startMinutes === 8 * 60)!;
    expect(monday8to9.freeCount).toBe(1);

    const tuesday9to10 = slots.find((s) => s.weekday === 2 && s.startMinutes === 9 * 60)!;
    expect(tuesday9to10.freeCount).toBe(1);
  });

  it("matches course codes case-insensitively and trims whitespace", () => {
    const slots = computeWeeklyAvailability({
      members: [{ id: "m1", displayName: "A", courseCodes: [" cs101 "] }],
      sessions: [{ courseCode: "CS101", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 10 * 60,
      slotMinutes: 60,
    });
    expect(slots[0].freeCount).toBe(0);
  });

  it("counts a member free when their course list has no matching session", () => {
    const slots = computeWeeklyAvailability({
      members: [{ id: "m1", displayName: "A", courseCodes: ["PHYS201"] }],
      sessions: [{ courseCode: "CS101", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 10 * 60,
      slotMinutes: 60,
    });
    expect(slots[0].freeCount).toBe(1);
  });

  it("ignores sessions with incomplete data instead of crashing", () => {
    const slots = computeWeeklyAvailability({
      members: [{ id: "m1", displayName: "A", courseCodes: ["CS101"] }],
      sessions: [{ courseCode: "CS101", weekday: null, startTime: "09:00", endTime: "10:00" }],
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 10 * 60,
      slotMinutes: 60,
    });
    expect(slots[0].freeCount).toBe(1);
  });

  it("detects partial overlap between a slot and a session", () => {
    const slots = computeWeeklyAvailability({
      members: [{ id: "m1", displayName: "A", courseCodes: ["CS101"] }],
      sessions: [{ courseCode: "CS101", weekday: 1, startTime: "09:45", endTime: "10:45" }],
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 11 * 60,
      slotMinutes: 60,
    });
    // 09:00-10:00 slot overlaps 09:45-10:45 session partially -> busy
    const first = slots.find((s) => s.startMinutes === 9 * 60)!;
    expect(first.freeCount).toBe(0);
    // 10:00-11:00 slot also overlaps (09:45-10:45 ends inside it) -> busy
    const second = slots.find((s) => s.startMinutes === 10 * 60)!;
    expect(second.freeCount).toBe(0);
  });
});

describe("findBestWindows", () => {
  it("prefers the window with the highest average free ratio", () => {
    const slots = computeWeeklyAvailability({
      members: [
        { id: "m1", displayName: "A", courseCodes: ["CS101"] },
        { id: "m2", displayName: "B", courseCodes: [] },
      ],
      sessions: [{ courseCode: "CS101", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 12 * 60,
      slotMinutes: 60,
    });

    const best = findBestWindows(slots, 60, 60, 1)[0];
    // 08:00-09:00 and 10:00-12:00 have both members free (ratio 1.0);
    // 09:00-10:00 has only 1/2 free. Best window must not be 09:00.
    expect(best.startMinutes).not.toBe(9 * 60);
    expect(best.averageFreeRatio).toBe(1);
  });

  it("only returns contiguous windows spanning the requested duration", () => {
    const slots = computeWeeklyAvailability({
      members: [{ id: "m1", displayName: "A", courseCodes: [] }],
      sessions: [],
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 10 * 60,
      slotMinutes: 30,
    });
    const windows = findBestWindows(slots, 90, 30, 100);
    for (const w of windows) {
      expect(w.endMinutes - w.startMinutes).toBe(90);
    }
  });
});
