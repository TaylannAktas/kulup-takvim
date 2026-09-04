import { describe, it, expect } from "vitest";
import { assignColumnsForOverlap, type TimelineItem } from "@/components/calendar/HourlyTimeline";

function item(id: string, startMinutes: number, endMinutes: number): TimelineItem {
  return { id, label: id, kind: "course_session", startMinutes, endMinutes };
}

describe("assignColumnsForOverlap", () => {
  it("gives sequential non-overlapping items their own full-width column", () => {
    const items = [item("a", 600, 660), item("b", 660, 720), item("c", 720, 780)];
    const result = assignColumnsForOverlap(items);
    for (const r of result) {
      expect(r.column).toBe(0);
      expect(r.columnCount).toBe(1);
    }
  });

  it("splits two overlapping items into two equal columns", () => {
    const items = [item("a", 600, 660), item("b", 630, 690)];
    const result = assignColumnsForOverlap(items);
    const byId = Object.fromEntries(result.map((r) => [r.item.id, r]));
    expect(byId.a.columnCount).toBe(2);
    expect(byId.b.columnCount).toBe(2);
    expect(byId.a.column).not.toBe(byId.b.column);
  });

  it("gives every item in a 3-way overlapping cluster the same columnCount", () => {
    const items = [item("a", 600, 660), item("b", 630, 720), item("c", 645, 675)];
    const result = assignColumnsForOverlap(items);
    const counts = new Set(result.map((r) => r.columnCount));
    expect(counts.size).toBe(1);
    expect([...counts][0]).toBe(3);
    const columns = new Set(result.map((r) => r.column));
    expect(columns.size).toBe(3);
  });

  it("does not let an unrelated later cluster inflate an earlier cluster's columnCount", () => {
    const items = [
      item("a", 600, 660),
      item("b", 630, 690), // overlaps a -> cluster of 2
      item("c", 900, 960),
      item("d", 930, 990), // overlaps c -> separate cluster of 2
    ];
    const result = assignColumnsForOverlap(items);
    for (const r of result) {
      expect(r.columnCount).toBe(2);
    }
  });
});
