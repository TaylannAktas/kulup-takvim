import { pgTable, text, timestamp, boolean, pgEnum, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const eventStatus = pgEnum("event_status", [
  "fikir",
  "planlaniyor",
  "onaylandi",
  "yapildi",
  "iptal",
]);

export const clubEvents = pgTable("club_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  isAllDay: boolean("is_all_day").notNull().default(false),
  status: eventStatus("status").notNull().default("fikir"),
  location: text("location"),
  expectedAttendance: integer("expected_attendance"),
  colorOverride: text("color_override"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  conflictFlags: jsonb("conflict_flags"),
});
