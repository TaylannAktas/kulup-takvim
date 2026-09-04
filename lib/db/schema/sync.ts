import { pgTable, text, timestamp, pgEnum, integer, jsonb } from "drizzle-orm/pg-core";

export const syncSource = pgEnum("sync_source", ["akademik_takvim", "sinav_programi"]);

export const syncStatus = pgEnum("sync_status", ["ok", "kismi", "hata", "needs_mapping"]);

export const syncChangeType = pgEnum("sync_change_type", [
  "eklendi",
  "silindi",
  "guncellendi",
]);

export const syncRuns = pgTable("sync_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: syncSource("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: syncStatus("status").notNull(),
  fetchedCount: integer("fetched_count"),
  changedCount: integer("changed_count"),
  errorDetail: text("error_detail"),
});

export const syncChanges = pgTable("sync_changes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  syncRunId: text("sync_run_id").references(() => syncRuns.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  changeType: syncChangeType("change_type").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});
