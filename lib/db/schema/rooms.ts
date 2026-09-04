import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  code: text("code").primaryKey(),
  building: text("building"),
  capacity: integer("capacity"),
});
