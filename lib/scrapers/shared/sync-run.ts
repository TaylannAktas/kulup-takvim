import "server-only";
import { db } from "@/lib/db";
import { syncRuns, syncChanges, syncSource } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type SyncSource = (typeof syncSource.enumValues)[number];

export async function startSyncRun(source: SyncSource) {
  const [run] = await db
    .insert(syncRuns)
    .values({ id: crypto.randomUUID(), source, status: "hata" })
    .returning();
  return run;
}

export async function finishSyncRun(
  runId: string,
  result: {
    status: "ok" | "kismi" | "hata" | "needs_mapping";
    fetchedCount?: number;
    changedCount?: number;
    errorDetail?: string;
  }
) {
  await db
    .update(syncRuns)
    .set({
      finishedAt: new Date(),
      status: result.status,
      fetchedCount: result.fetchedCount,
      changedCount: result.changedCount,
      errorDetail: result.errorDetail,
    })
    .where(eq(syncRuns.id, runId));
}

export async function recordChange(params: {
  syncRunId: string;
  entityType: string;
  entityId: string;
  changeType: "eklendi" | "silindi" | "guncellendi";
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(syncChanges).values({
    id: crypto.randomUUID(),
    syncRunId: params.syncRunId,
    entityType: params.entityType,
    entityId: params.entityId,
    changeType: params.changeType,
    before: params.before ?? null,
    after: params.after ?? null,
  });
}
