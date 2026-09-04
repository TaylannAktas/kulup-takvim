import { pgTable, text, timestamp, date } from "drizzle-orm/pg-core";
import { users } from "./users";

export const dayNotes = pgTable("day_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: date("date", { mode: "date" }).notNull(),
  body: text("body").notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
