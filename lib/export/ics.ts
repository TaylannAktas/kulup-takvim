/**
 * RFC 5545 iCalendar (.ics) export generator.
 * Produces valid calendar files for import into Google Calendar, Apple Calendar, Outlook, etc.
 */

export type IcsEventInput = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  location: string | null;
};

/**
 * Escape special characters in iCalendar text fields per RFC 5545.
 * Required escapes: backslash (\\), semicolon (\;), comma (\,), newline (\n)
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\") // backslash first (must be before other escapes)
    .replace(/;/g, "\\;") // semicolon
    .replace(/,/g, "\\,") // comma
    .replace(/\n/g, "\\n"); // newline (literal backslash-n, not actual newline)
}

/**
 * Format a Date as UTC YYYYMMDDTHHMMSSZ for iCalendar timestamps.
 * Used for timed events and DTSTAMP (when entry was generated).
 */
function formatUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * Format a Date as YYYYMMDD for all-day events (date-only format per RFC 5545).
 * Extract date components from UTC time to avoid timezone confusion.
 */
function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Generate a valid RFC 5545 iCalendar (.ics) document from an array of events.
 * Lines are joined with CRLF (\r\n) as per spec. Long lines are not folded
 * (simplification: modern calendar clients tolerate unfolded lines fine).
 */
export function generateIcsCalendar(events: IcsEventInput[], calendarName: string): string {
  const now = new Date();
  const dtstamp = formatUtcTimestamp(now);

  const lines: string[] = [];

  // RFC 5545 header
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Kulup Takvim//TR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`X-WR-CALNAME:${escapeIcsText(calendarName)}`);

  // Events
  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@kulup-takvim`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (event.isAllDay) {
      // All-day events use DATE format (YYYYMMDD, no time/Z)
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startAt)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(event.endAt)}`);
    } else {
      // Timed events use UTC format with Z suffix
      lines.push(`DTSTART:${formatUtcTimestamp(event.startAt)}`);
      lines.push(`DTEND:${formatUtcTimestamp(event.endAt)}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    lines.push("END:VEVENT");
  }

  // RFC 5545 footer
  lines.push("END:VCALENDAR");

  // Join with CRLF as per iCalendar spec
  return lines.join("\r\n");
}
