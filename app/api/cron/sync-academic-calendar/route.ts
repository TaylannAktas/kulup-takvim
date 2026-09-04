import { NextRequest, NextResponse } from "next/server";
import { isValidCronRequest } from "@/lib/cron-auth";
import { currentAcademicYear } from "@/lib/calendar/academic-year";

// lib/db, DATABASE_URL yoksa modül yüklenirken hata fırlatıyor (bkz. lib/db/index.ts).
// auth.ts'teki gibi: DB'ye dokunan modülü istek anında dinamik import ediyoruz ki
// build (next build "collect page data" adımı) DATABASE_URL'e bağımlı olmasın.

export const dynamic = "force-dynamic";

/**
 * Günde bir kez Vercel Cron tarafından tetiklenir (spesifikasyon §4.4, 03:00 TR).
 * Oturumdan bağımsız — sadece CRON_SECRET ile korunur (proxy.ts bu yolu muaf tutar).
 */
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return new NextResponse(null, { status: 401 });
  }

  const thisYear = currentAcademicYear();
  const nextYear = incrementAcademicYear(thisYear);

  const current = await runSync(thisYear);

  // Bir sonraki akademik yılın sayfası henüz yayınlanmamış olabilir; bu
  // durumda hata normaldir ve ana sonucu etkilememeli. runSync hiçbir zaman
  // fırlatmaz (aşağıda kendi try/catch'i var), bu yüzden ek bir .catch gerekmez.
  const next = await runSync(nextYear);

  return NextResponse.json({
    current,
    next,
  });
}

function incrementAcademicYear(sourceYear: string): string {
  const [start, end] = sourceYear.split("-").map(Number);
  return `${start + 1}-${end + 1}`;
}

async function runSync(sourceYear: string) {
  try {
    const { syncAcademicCalendarYear } = await import("@/lib/scrapers/academic-calendar/diff");
    const result = await syncAcademicCalendarYear(sourceYear);
    return { sourceYear, ok: true as const, ...result };
  } catch (error) {
    return {
      sourceYear,
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
