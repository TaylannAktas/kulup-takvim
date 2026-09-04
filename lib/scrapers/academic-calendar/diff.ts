import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries } from "@/lib/db/schema";
import { startSyncRun, finishSyncRun, recordChange } from "@/lib/scrapers/shared/sync-run";
import { discoverAndFetchAcademicCalendarPage } from "./fetch";
import { parseAcademicCalendarHtml, type ParsedAcademicCalendarRow } from "./parse";

const ENTITY_TYPE = "academic_calendar_entry";

/** Aynı yıl içinde eşleşme anahtarı: dönem + içerik hash'i. */
function rowKey(term: string, sourceHash: string): string {
  return `${term}::${sourceHash}`;
}

export type AcademicCalendarDiffResult = {
  fetchedCount: number;
  changedCount: number;
  insertedCount: number;
  deactivatedCount: number;
  unchangedCount: number;
};

/**
 * Ayrıştırılmış satırları veritabanındaki mevcut kayıtlarla karşılaştırır.
 *
 * - Yeni hash → INSERT (firstSeenAt = lastSeenAt = now, isActive = true)
 * - Var olan hash tekrar görüldü → lastSeenAt güncellenir (içerik değişimi
 *   zaten yeni bir hash üretir, yani "guncellendi" durumu oluşmaz)
 * - Daha önce aktif olup bu turda görülmeyen hash → isActive = false (yumuşak
 *   silme; spesifikasyon geçmişin korunmasını istiyor, kayıt silinmez)
 */
export async function diffAcademicCalendarRows(
  sourceYear: string,
  rows: ParsedAcademicCalendarRow[],
  syncRunId: string
): Promise<AcademicCalendarDiffResult> {
  const existing = await db
    .select()
    .from(academicCalendarEntries)
    .where(eq(academicCalendarEntries.sourceYear, sourceYear));

  const existingByKey = new Map(existing.map((row) => [rowKey(row.term, row.sourceHash), row]));

  // Aynı turda birebir aynı satır iki kez geldiyse (aynı dönem + aynı hash)
  // tek kayıt olarak işlenir.
  const freshByKey = new Map<string, ParsedAcademicCalendarRow>();
  for (const row of rows) {
    const key = rowKey(row.term, row.sourceHash);
    if (!freshByKey.has(key)) freshByKey.set(key, row);
  }

  const now = new Date();
  let insertedCount = 0;
  let deactivatedCount = 0;
  let unchangedCount = 0;

  for (const [key, row] of freshByKey) {
    const current = existingByKey.get(key);

    if (!current) {
      const [inserted] = await db
        .insert(academicCalendarEntries)
        .values({
          sourceYear,
          term: row.term,
          startDate: row.startDate,
          endDate: row.endDate,
          description: row.description,
          category: row.category,
          sourceHash: row.sourceHash,
          firstSeenAt: now,
          lastSeenAt: now,
          isActive: true,
        })
        .returning();
      insertedCount += 1;
      await recordChange({
        syncRunId,
        entityType: ENTITY_TYPE,
        entityId: inserted.id,
        changeType: "eklendi",
        after: inserted,
      });
      continue;
    }

    // Hash aynı → içerik aynı. Sadece "hâlâ duruyor" bilgisi güncellenir.
    // Daha önce pasife alınmış bir kayıt yeniden göründüyse tekrar aktifleşir.
    const reactivated = !current.isActive;
    await db
      .update(academicCalendarEntries)
      .set({ lastSeenAt: now, isActive: true })
      .where(eq(academicCalendarEntries.id, current.id));

    if (reactivated) {
      insertedCount += 1;
      await recordChange({
        syncRunId,
        entityType: ENTITY_TYPE,
        entityId: current.id,
        changeType: "eklendi",
        before: current,
        after: { ...current, isActive: true, lastSeenAt: now },
      });
    } else {
      unchangedCount += 1;
    }
  }

  for (const current of existing) {
    if (!current.isActive) continue;
    if (freshByKey.has(rowKey(current.term, current.sourceHash))) continue;

    await db
      .update(academicCalendarEntries)
      .set({ isActive: false })
      .where(
        and(
          eq(academicCalendarEntries.id, current.id),
          eq(academicCalendarEntries.sourceYear, sourceYear)
        )
      );
    deactivatedCount += 1;
    await recordChange({
      syncRunId,
      entityType: ENTITY_TYPE,
      entityId: current.id,
      changeType: "silindi",
      before: current,
      after: { ...current, isActive: false },
    });
  }

  return {
    fetchedCount: freshByKey.size,
    changedCount: insertedCount + deactivatedCount,
    insertedCount,
    deactivatedCount,
    unchangedCount,
  };
}

/**
 * Uçtan uca senkronizasyon: keşif + indirme + ayrıştırma + fark alma,
 * `sync_runs` / `sync_changes` kayıtlarıyla birlikte.
 * İleride cron route handler'ı bu fonksiyonu çağıracak.
 */
export async function syncAcademicCalendarYear(
  sourceYear: string
): Promise<{ fetchedCount: number; changedCount: number }> {
  const run = await startSyncRun("akademik_takvim");

  try {
    const { html, sourceUrl } = await discoverAndFetchAcademicCalendarPage(sourceYear);
    const { rows, warnings } = parseAcademicCalendarHtml(html, sourceYear);

    if (rows.length === 0) {
      throw new Error(
        `Akademik takvim ayrıştırıldı ancak hiç satır bulunamadı (${sourceYear}, ${sourceUrl}).`
      );
    }

    const result = await diffAcademicCalendarRows(sourceYear, rows, run.id);

    const errorDetail = warnings.length
      ? [`Kaynak: ${sourceUrl}`, ...warnings].join("\n")
      : undefined;

    await finishSyncRun(run.id, {
      status: warnings.length ? "kismi" : "ok",
      fetchedCount: result.fetchedCount,
      changedCount: result.changedCount,
      errorDetail,
    });

    return { fetchedCount: result.fetchedCount, changedCount: result.changedCount };
  } catch (error) {
    await finishSyncRun(run.id, {
      status: "hata",
      errorDetail: error instanceof Error ? `${error.message}\n${error.stack ?? ""}`.trim() : String(error),
    });
    throw error;
  }
}
