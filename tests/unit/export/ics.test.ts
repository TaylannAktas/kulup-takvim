import { describe, it, expect } from "vitest";
import { generateIcsCalendar, type IcsEventInput } from "@/lib/export/ics";

describe("ICS Calendar Export", () => {
  it("generates a valid VCALENDAR structure", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Team Meeting",
        description: null,
        startAt: new Date("2025-10-15T10:00:00Z"),
        endAt: new Date("2025-10-15T11:00:00Z"),
        isAllDay: false,
        location: "Room A",
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Kulup Takvim//TR");
    expect(ics).toContain("X-WR-CALNAME:Test Calendar");
  });

  it("creates one VEVENT block per event", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Event 1",
        description: null,
        startAt: new Date("2025-10-15T10:00:00Z"),
        endAt: new Date("2025-10-15T11:00:00Z"),
        isAllDay: false,
        location: null,
      },
      {
        id: "evt-002",
        title: "Event 2",
        description: null,
        startAt: new Date("2025-10-16T14:00:00Z"),
        endAt: new Date("2025-10-16T15:00:00Z"),
        isAllDay: false,
        location: null,
      },
      {
        id: "evt-003",
        title: "All Day Event",
        description: null,
        startAt: new Date("2025-10-17T00:00:00Z"),
        endAt: new Date("2025-10-17T00:00:00Z"),
        isAllDay: true,
        location: null,
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;

    expect(eventCount).toBe(3);
    expect(ics).toContain("UID:evt-001@kulup-takvim");
    expect(ics).toContain("UID:evt-002@kulup-takvim");
    expect(ics).toContain("UID:evt-003@kulup-takvim");
  });

  it("formats timed events with UTC timestamps (YYYYMMDDTHHMMSSZ)", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Meeting",
        description: null,
        startAt: new Date("2025-10-15T10:30:45Z"),
        endAt: new Date("2025-10-15T11:45:30Z"),
        isAllDay: false,
        location: null,
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");

    expect(ics).toContain("DTSTART:20251015T103045Z");
    expect(ics).toContain("DTEND:20251015T114530Z");
  });

  it("formats all-day events with DATE format (VALUE=DATE:YYYYMMDD)", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Holiday",
        description: null,
        startAt: new Date("2025-10-15T00:00:00Z"),
        endAt: new Date("2025-10-16T00:00:00Z"),
        isAllDay: true,
        location: null,
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");

    expect(ics).toContain("DTSTART;VALUE=DATE:20251015");
    expect(ics).toContain("DTEND;VALUE=DATE:20251016");
    expect(ics).not.toContain("DTSTART:20251015T");
  });

  it("properly escapes special characters in text fields", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Meeting; with semicolon, and comma",
        description: "Multi-line\ndescription with\nnewlines and backslash \\ character",
        startAt: new Date("2025-10-15T10:00:00Z"),
        endAt: new Date("2025-10-15T11:00:00Z"),
        isAllDay: false,
        location: "Room (A), Building B; Floor 3",
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");

    expect(ics).toContain("SUMMARY:Meeting\\; with semicolon\\, and comma");
    expect(ics).toContain("DESCRIPTION:Multi-line\\ndescription with\\nnewlines and backslash \\\\ character");
    expect(ics).toContain("LOCATION:Room (A)\\, Building B\\; Floor 3");
  });

  it("includes event title, description, and location", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Important Meeting",
        description: "Discuss Q4 roadmap",
        startAt: new Date("2025-10-15T10:00:00Z"),
        endAt: new Date("2025-10-15T11:00:00Z"),
        isAllDay: false,
        location: "Conference Room A",
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");

    expect(ics).toContain("SUMMARY:Important Meeting");
    expect(ics).toContain("DESCRIPTION:Discuss Q4 roadmap");
    expect(ics).toContain("LOCATION:Conference Room A");
  });

  it("omits DESCRIPTION and LOCATION when null", () => {
    const events: IcsEventInput[] = [
      {
        id: "evt-001",
        title: "Minimal Event",
        description: null,
        startAt: new Date("2025-10-15T10:00:00Z"),
        endAt: new Date("2025-10-15T11:00:00Z"),
        isAllDay: false,
        location: null,
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");

    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("joins lines with CRLF (\\r\\n)", () => {
    const events: IcsEventInput[] = [];
    const ics = generateIcsCalendar(events, "Test Calendar");

    // Check that lines are joined with CRLF, not just LF
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    // Should not have LF without CR
    const lines = ics.split("\r\n");
    // Verify no line contains a bare newline
    lines.forEach((line) => {
      expect(line).not.toContain("\n");
    });
  });

  it("generates unique stable UIDs from event IDs", () => {
    const events: IcsEventInput[] = [
      {
        id: "abc-123",
        title: "Event",
        description: null,
        startAt: new Date("2025-10-15T10:00:00Z"),
        endAt: new Date("2025-10-15T11:00:00Z"),
        isAllDay: false,
        location: null,
      },
    ];

    const ics = generateIcsCalendar(events, "Test Calendar");
    expect(ics).toContain("UID:abc-123@kulup-takvim");
  });

  it("handles empty event list", () => {
    const ics = generateIcsCalendar([], "Empty Calendar");

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
