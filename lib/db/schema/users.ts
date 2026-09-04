import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "editor", "viewer"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: userRole("role").notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});
