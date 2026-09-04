import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sourceColumnMapping = pgTable("source_column_mapping", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceUrlPattern: text("source_url_pattern").notNull(),
  mapping: jsonb("mapping").notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
