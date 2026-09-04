import { NextRequest, NextResponse } from "next/server";
import { isValidCronRequest } from "@/lib/cron-auth";
import { fetchHtml } from "@/lib/scrapers/shared/http-client";
import { EXAM_SCHEDULE_INDEX_URL, discoverExamScheduleLinks } from "@/lib/scrapers/exam-schedule/fetch";
import { syncExamSchedule } from "@/lib/scrapers/exam-schedule/diff";

export const dynamic = "force-dynamic";

/**
 * Günde bir kez Vercel Cron tarafından tetiklenir (spesifikasyon §4.4, 03:15 TR).
 * Keşif sayfasında bulunan HER sınav programı bağlantısını sırayla senkronlar
 * (http-client zaten istekler arasında gecikme uyguluyor — paralel çekmiyoruz).
 */
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return new NextResponse(null, { status: 401 });
  }

  let links: ReturnType<typeof discoverExamScheduleLinks>;
  try {
    const indexHtml = await fetchHtml(EXAM_SCHEDULE_INDEX_URL);
    links = discoverExamScheduleLinks(indexHtml, EXAM_SCHEDULE_INDEX_URL);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }

  const results = [];
  for (const link of links) {
    // syncExamSchedule kendi içindeki hataları yakalayıp {status:"hata"} döner,
    // ama startSyncRun'ın kendisi (örn. DB'ye hiç ulaşılamıyorsa) try bloğunun
    // DIŞINDA olduğu için fırlatabilir — tek bir kaynağın çökmesi diğer
    // kaynakların senkronunu engellemesin diye burada da yakalanıyor.
    try {
      const result = await syncExamSchedule(link.url, link.facultyCode, link.examType, link.termCode);
      results.push({ ...link, ...result });
    } catch (error) {
      results.push({
        ...link,
        status: "hata" as const,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    discovered: links.length,
    results,
    conflictRecompute: await runConflictRecompute(),
  });
}

/**
 * Okul bir sınav tarihini değiştirdiğinde "dün sorunsuz olan etkinlik bugün
 * uyarı gösteriyor" davranışı buradan doğuyor (spec §4.5). Senkron değişiklik
 * üretmese bile ucuz ve idempotent olduğu için koşulsuz çalıştırılıyor.
 *
 * Yukarıdaki savunmacı desenle aynı: buradaki bir hata cron yanıtını
 * çökertmemeli, sadece yanıta yazılmalı.
 */
async function runConflictRecompute() {
  try {
    const { recomputeAllActiveEventConflicts } = await import("@/lib/calendar/conflict-detection");
    return { ok: true as const, ...(await recomputeAllActiveEventConflicts()) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
