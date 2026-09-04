import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const memberCategory = pgEnum("member_category", ["uye", "hedef_kitle"]);

export const members = pgTable("members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  displayName: text("display_name").notNull(),
  category: memberCategory("category").notNull(),
  facultyCode: text("faculty_code"),
  programName: text("program_name"),
  classYear: text("class_year"),
  courseCodes: text("course_codes").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
