import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions } from "@/lib/db/schema";
import { startSyncRun, finishSyncRun, recordChange } from "@/lib/scrapers/shared/sync-run";
import { fetchExamScheduleFrameset, type ExamType } from "./fetch";
import { findSavedColumnMapping } from "./column-mapping";
import {
  parseExamScheduleHtml,
  type ExamScheduleParseResult,
  type ParsedExamSession,
} from "./parse";

const ENTITY_TYPE = "exam_session";

export type ExamScheduleDiffResult = {
  fetchedCount: number;
  changedCount: number;
  insertedCount: number;
  deactivatedCount: number;
  unchangedCount: number;
};

/**
 * Ayrıştırılmış sınav oturumlarını veritabanındaki kayıtlarla karşılaştırır.
 *
 * Eşleşme anahtarı: `sourceHash` — ama karşılaştırma kapsamı
 * `termCode` + `facultyCode` + `examType` üçlüsüyle sınırlı. Yani bir
 * fakültenin arasınav programını senkronize etmek başka bir fakültenin ya da
 * final programının kayıtlarını asla pasife almaz.
 *
 * Akademik takvimdeki gibi yumuşak silme: kayıt silinmez, `isActive=false`
 * yapılır; aynı hash tekrar görülürse yeniden aktifleşir.
 */
export async function diffExamSessions(
  scope: { termCode: string; facultyCode: string; examType: ExamType },
  rows: ParsedExamSession[],
  syncRunId: string
): Promise<ExamScheduleDiffResult> {
  const scopeFilter = and(
    eq(examSessions.termCode, scope.termCode),
    eq(examSessions.facultyCode, scope.facultyCode),
    eq(examSessions.examType, scope.examType)
  );

  const existing = await db.select().from(examSessions).where(scopeFilter);
  const existingByHash = new Map(existing.map((row) => [row.sourceHash, row]));

  // Aynı turda birebir aynı satır iki kez geldiyse (aynı hash) tek kayıt sayılır.
  const freshByHash = new Map<string, ParsedExamSession>();
  for (const row of rows) {
    if (!freshByHash.has(row.sourceHash)) freshByHash.set(row.sourceHash, row);
  }

  const now = new Date();
  let insertedCount = 0;
  let deactivatedCount = 0;
  let unchangedCount = 0;

  for (const [hash, row] of freshByHash) {
    const current = existingByHash.get(hash);

    if (!current) {
      // onConflictDoNothing: yukarıdaki SELECT ile buradaki INSERT arasında
      // çakışan bir sync çalıştırması aynı (termCode, facultyCode, examType,
      // sourceHash) satırını araya sıkıştırmış olabilir — DB'deki unique index
      // bu durumda insert'i sessizce iptal eder, `inserted` undefined döner.
      const [inserted] = await db
        .insert(examSessions)
        .values({
          facultyCode: row.facultyCode,
          examType: row.examType,
          termCode: row.termCode,
          courseCode: row.courseCode,
          courseName: row.courseName,
          section: row.section,
          examDate: row.examDate,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
          rawRow: row.rawRow,
          sourceUrl: row.sourceUrl,
          sourceHash: row.sourceHash,
          firstSeenAt: now,
          lastSeenAt: now,
          isActive: true,
        })
        .onConflictDoNothing({
          target: [examSessions.termCode, examSessions.facultyCode, examSessions.examType, examSessions.sourceHash],
        })
        .returning();

      if (!inserted) {
        unchangedCount += 1;
        continue;
      }

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

    const reactivated = !current.isActive;
    await db
      .update(examSessions)
      .set({ lastSeenAt: now, isActive: true })
      .where(eq(examSessions.id, current.id));

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
    if (freshByHash.has(current.sourceHash)) continue;

    await db
      .update(examSessions)
      .set({ isActive: false })
      .where(eq(examSessions.id, current.id));
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
    fetchedCount: freshByHash.size,
    changedCount: insertedCount + deactivatedCount,
    insertedCount,
    deactivatedCount,
    unchangedCount,
  };
}

export type SyncExamScheduleResult = {
  status: "ok" | "needs_mapping" | "hata";
  fetchedCount?: number;
  changedCount?: number;
};

/**
 * Uçtan uca senkronizasyon: frameset indirme + sütun eşleme + ayrıştırma +
 * fark alma, `sync_runs` / `sync_changes` kayıtlarıyla birlikte.
 *
 * Sütun eşlemesi yapılamaz ve kayıtlı elle eşleme de yoksa:
 * `sync_runs.status = "needs_mapping"` yazılır ve **hiçbir satır yazılmaz**.
 * Tahmin yürütmek, sessizce yanlış sütundan tarih okumaktan daha tehlikeli.
 *
 * Not: uyarı içeren (kısmi) çalışmalar `sync_runs`'a "kismi" olarak yazılır
 * ama dönüş değerinde "ok" görünür — dönüş tipi bilinçli olarak dar tutuldu,
 * ayrıntı `sync_runs.error_detail` içinde.
 */
export async function syncExamSchedule(
  rootUrl: string,
  facultyCode: string,
  examType: ExamType,
  termCode: string
): Promise<SyncExamScheduleResult> {
  const run = await startSyncRun("sinav_programi");

  try {
    const { sheetHtml, sheetUrl } = await fetchExamScheduleFrameset(rootUrl);
    const context = { facultyCode, examType, termCode, sourceUrl: sheetUrl };

    const structural = parseExamScheduleHtml(sheetHtml, context);
    let parsed: ExamScheduleParseResult;

    if (structural.needsManualMapping) {
      // Yapısal tespit çözemedi → daha önce elle kaydedilmiş eşleme var mı?
      const saved = await findSavedColumnMapping(rootUrl, facultyCode);

      if (!saved) {
        await finishSyncRun(run.id, {
          status: "needs_mapping",
          errorDetail: [
            `Kaynak: ${sheetUrl}`,
            structural.reason,
            `Bulunan başlık hücreleri: ${JSON.stringify(structural.headerCells)}`,
            "Kayıtlı elle sütun eşlemesi de yok. Panelden eşleme tanımlanmalı.",
          ].join("\n"),
        });
        return { status: "needs_mapping" };
      }

      const withSaved = parseExamScheduleHtml(sheetHtml, context, {
        columns: saved.columns,
        headerRowIndex: saved.headerRowIndex,
      });

      // Kayıtlı eşleme de çözemediyse (tablo tamamen değişmişse) yine dururuz.
      if (withSaved.needsManualMapping) {
        await finishSyncRun(run.id, {
          status: "needs_mapping",
          errorDetail: `Kaynak: ${sheetUrl}\nKayıtlı elle eşleme uygulanamadı: ${withSaved.reason}`,
        });
        return { status: "needs_mapping" };
      }

      parsed = withSaved;
    } else {
      parsed = structural;
    }

    if (parsed.rows.length === 0) {
      throw new Error(
        `Sınav programı ayrıştırıldı ancak hiç satır bulunamadı (${termCode}/${facultyCode}/${examType}, ${sheetUrl}).`
      );
    }

    const result = await diffExamSessions({ termCode, facultyCode, examType }, parsed.rows, run.id);

    const errorDetail = parsed.warnings.length
      ? [`Kaynak: ${sheetUrl}`, `Eşleme kaynağı: ${parsed.mappingSource}`, ...parsed.warnings].join("\n")
      : undefined;

    await finishSyncRun(run.id, {
      status: parsed.warnings.length ? "kismi" : "ok",
      fetchedCount: result.fetchedCount,
      changedCount: result.changedCount,
      errorDetail,
    });

    return {
      status: "ok",
      fetchedCount: result.fetchedCount,
      changedCount: result.changedCount,
    };
  } catch (error) {
    await finishSyncRun(run.id, {
      status: "hata",
      errorDetail:
        error instanceof Error ? `${error.message}\n${error.stack ?? ""}`.trim() : String(error),
    });
    return { status: "hata" };
  }
}
