import { describe, it, expect } from "vitest";
import {
  groupSessions,
  groupTimelineLabel,
  summaryBarLabel,
  collapseTimelineItems,
  describeGroupRows,
} from "@/lib/calendar/grouping";
import type { TimelineItem } from "@/components/calendar/HourlyTimeline";

function row(id: string, courseCode: string, section: string, room: string | null, startTime = "11:30:00", endTime = "13:20:00") {
  return { id, courseCode, section, room, startTime, endTime };
}

describe("groupSessions", () => {
  it("merges sections of the same course at the same time", () => {
    const groups = groupSessions([
      row("1", "CHE105", "05", "Müh. 1003 H"),
      row("2", "CHE105", "06", "Müh. 1009 H"),
      row("3", "CHE105", "07", "Müh. 2003H"),
      row("4", "CHE105", "08", "Müh. 1003 H", "13:30:00", "15:20:00"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].sections).toEqual(["05", "06", "07"]);
    expect(groupTimelineLabel(groups[0], "şube")).toBe("CHE105 · 3 şube");
    expect(groupTimelineLabel(groups[1], "şube")).toBe("CHE105 · Müh. 1003 H");
    expect(describeGroupRows(groups[0]).split("\n")[0]).toBe("Şb 05 · Müh. 1003 H");
  });

  it("keeps groups apart when the extra key differs", () => {
    const rows = [
      { ...row("1", "ENG101", "01", "A"), examType: "final" },
      { ...row("2", "ENG101", "02", "B"), examType: "mazeret" },
    ];
    expect(groupSessions(rows, (r) => r.examType)).toHaveLength(2);
  });
});

describe("summaryBarLabel", () => {
  it("shows the course code when there is a single group", () => {
    const groups = groupSessions([row("1", "ENG101", "01", "A", "09:30:00"), row("2", "ENG101", "02", "B", "09:30:00")]);
    expect(summaryBarLabel(groups, "sınav", { prefix: "Final", withTime: true })).toBe("ENG101 9.30");
  });

  it("shows count and time range for several groups", () => {
    const groups = groupSessions([
      row("1", "ENG101", "01", "A", "09:30:00", "11:20:00"),
      row("2", "CHE105", "01", "B", "14:30:00", "17:20:00"),
    ]);
    expect(summaryBarLabel(groups, "ders")).toBe("2 ders · 9.30–17.20");
  });
});

describe("collapseTimelineItems", () => {
  const item = (id: string, group: TimelineItem["group"], start: number, end: number): TimelineItem => ({
    id,
    label: id,
    kind: "exam_final",
    group,
    startMinutes: start,
    endMinutes: end,
  });

  it("merges overlapping items of one group and leaves others untouched", () => {
    const result = collapseTimelineItems(
      [item("a", "exam", 570, 680), item("b", "exam", 600, 720), item("c", "exam", 900, 960), item("e", "event", 600, 700)],
      "exam",
      "sınav"
    );
    expect(result.find((i) => i.id === "e")).toBeDefined();
    const collapsed = result.filter((i) => i.group === "exam");
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]).toMatchObject({ label: "2 sınav", startMinutes: 570, endMinutes: 720 });
    expect(collapsed[1]).toMatchObject({ label: "c", startMinutes: 900 });
  });
});
