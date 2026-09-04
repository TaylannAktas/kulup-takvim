import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { syncAcademicCalendarYear } from "@/lib/scrapers/academic-calendar/diff";
import { currentAcademicYear } from "@/lib/calendar/academic-year";
import { fetchHtml } from "@/lib/scrapers/shared/http-client";
import { EXAM_SCHEDULE_INDEX_URL, discoverExamScheduleLinks } from "@/lib/scrapers/exam-schedule/fetch";
import { syncExamSchedule } from "@/lib/scrapers/exam-schedule/diff";

const MAX_TRIGGERS_PER_WINDOW = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 saat

const bodySchema = z.object({
  source: z.enum(["akademik_takvim", "sinav_programi"]),
});

/**
 * Arayüzden "şimdi senkronize et" (spec §4.4) — sadece admin, oran sınırlı
 * (§8.8: kaynak siteye yük bindirmemek için). Cron uç noktalarının aksine
 * CRON_SECRET değil, admin oturumu ister.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return new NextResponse(null, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(`sync-trigger:${parsed.data.source}`, MAX_TRIGGERS_PER_WINDOW, WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok sık tetiklendi, biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) } }
    );
  }

  if (parsed.data.source === "akademik_takvim") {
    const year = currentAcademicYear();
    const result = await syncAcademicCalendarYear(year).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json({ source: parsed.data.source, year, result });
  }

  // sinav_programi
  const indexHtml = await fetchHtml(EXAM_SCHEDULE_INDEX_URL);
  const links = discoverExamScheduleLinks(indexHtml, EXAM_SCHEDULE_INDEX_URL);
  const results = [];
  for (const link of links) {
    try {
      const result = await syncExamSchedule(link.url, link.facultyCode, link.examType, link.termCode);
      results.push({ ...link, ...result });
    } catch (error) {
      results.push({ ...link, status: "hata" as const, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ source: parsed.data.source, discovered: links.length, results });
}
