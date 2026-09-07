import { pgTable, text, timestamp, integer, time, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const timetableImports = pgTable("timetable_imports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  uploadedBy: text("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  sourceLabel: text("source_label"),
  termCode: text("term_code"),
  parsedSessionCount: integer("parsed_session_count"),
  notes: text("notes"),
  /**
   * Bu sayfadaki dönem (saat) sütunları — `ParsedPeriod[]` JSON'u (bkz.
   * lib/timetable-import/parse-svg-timetable.ts). Gün ayrıntı çizelgesini
   * okulun sitesindeki gibi ders saatlerine bölebilmek için (2026-09-07).
   * Bu sütun eklenmeden önce yapılmış içe aktarmalarda null olur — çizelge
   * bu durumda genel saat ızgarasına düşer (bkz. HourlyTimeline).
   */
  periods: jsonb("periods"),
});

export const courseSessions = pgTable("course_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  importId: text("import_id").references(() => timetableImports.id),
  courseCode: text("course_code"),
  courseName: text("course_name"),
  section: text("section"),
  facultyCode: text("faculty_code"),
  programName: text("program_name"),
  classYear: text("class_year"),
  weekday: integer("weekday"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  room: text("room"),
  instructor: text("instructor"),
});
