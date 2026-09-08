import { pgTable, text, timestamp, boolean, pgEnum, date, time, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const examType = pgEnum("exam_type", ["arasinav", "final", "mazeret"]);

export const examSessions = pgTable(
  "exam_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    facultyCode: text("faculty_code").notNull(),
    examType: examType("exam_type").notNull(),
    termCode: text("term_code").notNull(),
    courseCode: text("course_code"),
    courseName: text("course_name"),
    section: text("section"),
    examDate: date("exam_date", { mode: "date" }),
    startTime: time("start_time"),
    endTime: time("end_time"),
    room: text("room"),
    rawRow: jsonb("raw_row").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceHash: text("source_hash").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    // diffExamSessions'daki "önce SELECT, sonra INSERT" kontrolü atomik değil;
    // çakışan iki senkron çalıştırması (2026-09-05'te olduğu gibi) aynı hash'i
    // aynı anda "yok" görüp ikisi de ekleyebiliyordu. Bu constraint DB seviyesinde
    // ikinci insert'i engeller (diff.ts artık onConflictDoNothing kullanıyor).
    uniqueIndex("exam_sessions_scope_hash_idx").on(
      table.termCode,
      table.facultyCode,
      table.examType,
      table.sourceHash
    ),
  ]
);
