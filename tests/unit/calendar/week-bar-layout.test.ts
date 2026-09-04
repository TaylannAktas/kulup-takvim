import { describe, it, expect } from "vitest";
import { assignWeekBarLanes } from "@/lib/calendar/week-bar-layout";
import type { CalendarBarItem } from "@/lib/calendar/month-events";

function bar(id: string, start: string, end: string): CalendarBarItem {
  return { id, label: id, kind: "academic_tatil", startDate: new Date(start), endDate: new Date(end) };
}

const MONDAY = new Date(2026, 8, 7); // 2026-09-07, bir Pazartesi

describe("assignWeekBarLanes", () => {
  it("places a single multi-day bar spanning the correct columns", () => {
    const bars = [bar("a", "2026-09-08", "2026-09-10")]; // Salı-Perşembe
    const result = assignWeekBarLanes(bars, MONDAY);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startCol: 1, endCol: 3, lane: 0 });
  });

  it("clips a bar that starts before the week to column 0", () => {
    const bars = [bar("a", "2026-09-01", "2026-09-09")];
    const result = assignWeekBarLanes(bars, MONDAY);
    expect(result[0]).toMatchObject({ startCol: 0, endCol: 2 });
  });

  it("clips a bar that ends after the week to column 6", () => {
    const bars = [bar("a", "2026-09-10", "2026-09-20")];
    const result = assignWeekBarLanes(bars, MONDAY);
    expect(result[0]).toMatchObject({ startCol: 3, endCol: 6 });
  });

  it("drops a bar that does not overlap the week at all", () => {
    const bars = [bar("a", "2026-08-01", "2026-08-05")];
    expect(assignWeekBarLanes(bars, MONDAY)).toHaveLength(0);
  });

  it("gives non-overlapping sequential bars the same lane", () => {
    const bars = [bar("a", "2026-09-07", "2026-09-08"), bar("b", "2026-09-09", "2026-09-10")];
    const result = assignWeekBarLanes(bars, MONDAY);
    expect(result.find((r) => r.bar.id === "a")?.lane).toBe(0);
    expect(result.find((r) => r.bar.id === "b")?.lane).toBe(0);
  });

  it("gives overlapping bars different lanes", () => {
    const bars = [bar("a", "2026-09-07", "2026-09-10"), bar("b", "2026-09-09", "2026-09-11")];
    const result = assignWeekBarLanes(bars, MONDAY);
    const laneA = result.find((r) => r.bar.id === "a")?.lane;
    const laneB = result.find((r) => r.bar.id === "b")?.lane;
    expect(laneA).not.toBe(laneB);
  });
});
