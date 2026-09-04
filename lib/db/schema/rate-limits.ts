import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * DB tabanlı basit oran sınırlama sayacı (spec §8.8 — manuel senkron tetikleme
 * ucu için). Redis/Upstash gibi ek bir bağımlılık eklemekten kaçınmak için;
 * bu ölçekte (3 kullanıcı, tek uç nokta) bir kayıt üzerinde okuma+yazma yeterli.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});
