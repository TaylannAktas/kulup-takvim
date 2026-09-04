import { pgTable, text, timestamp, boolean, pgEnum, date } from "drizzle-orm/pg-core";

export const academicTerm = pgEnum("academic_term", ["guz", "bahar", "yaz"]);

export const academicCalendarCategory = pgEnum("academic_calendar_category", [
  "SINAV",
  "TATIL",
  "DERS_DONEMI",
  "KAYIT",
  "IDARI",
]);

export const academicCalendarEntries = pgTable("academic_calendar_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceYear: text("source_year").notNull(),
  term: academicTerm("term").notNull(),
  startDate: date("start_date", { mode: "date" }),
  endDate: date("end_date", { mode: "date" }),
  description: text("description").notNull(),
  category: academicCalendarCategory("category").notNull(),
  categoryOverride: academicCalendarCategory("category_override"),
  sourceHash: text("source_hash").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});
