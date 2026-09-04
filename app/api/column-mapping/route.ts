import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sourceColumnMapping } from "@/lib/db/schema";
import { parseExamScheduleUrl } from "@/lib/scrapers/exam-schedule/fetch";
import { saveColumnMapping, exactUrlPattern, facultyUrlPattern } from "@/lib/scrapers/exam-schedule/column-mapping";
import { syncExamSchedule } from "@/lib/scrapers/exam-schedule/diff";

export async function GET() {
  const rows = await db.select().from(sourceColumnMapping).orderBy(desc(sourceColumnMapping.createdAt));
  return NextResponse.json({ mappings: rows });
}

const saveSchema = z.object({
  rootUrl: z.string().url(),
  scope: z.enum(["exact", "faculty"]),
  headerRowIndex: z.number().int().min(0),
  columns: z.object({
    courseCode: z.number().int().min(0),
    examDate: z.number().int().min(0),
    startTime: z.number().int().min(0),
    endTime: z.number().int().min(0),
    courseName: z.number().int().min(0).nullable(),
    room: z.number().int().min(0).nullable(),
  }),
});

/**
 * Elle yapılmış sütun eşlemesini kaydeder (spec §4.2 — "kullanıcı bir kez sütun
 * eşlemesini seçer, source_column_mapping tablosuna kaydedilir, sonraki
 * senkronlarda kullanılır"). "Veri kaynağı ayarı" olduğu için sadece admin
 * (§2.2 roller tablosu).
 *
 * Kaydettikten hemen sonra ilgili kaynağı bir kez senkronlar ki düzeltme
 * bir sonraki cron'u beklemesin.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return new NextResponse(null, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const urlInfo = parseExamScheduleUrl(parsed.data.rootUrl);
  if (!urlInfo) {
    return NextResponse.json({ error: "Geçersiz sınav programı URL'i." }, { status: 400 });
  }

  const sourceUrlPattern =
    parsed.data.scope === "exact"
      ? exactUrlPattern(parsed.data.rootUrl)
      : facultyUrlPattern(urlInfo.facultyCode);

  const saved = await saveColumnMapping({
    sourceUrlPattern,
    mapping: {
      kind: "exam-schedule",
      columns: parsed.data.columns,
      headerRowIndex: parsed.data.headerRowIndex,
    },
    createdBy: session.user.id,
  });

  const syncResult = await syncExamSchedule(
    parsed.data.rootUrl,
    urlInfo.facultyCode,
    urlInfo.examType,
    urlInfo.termCode
  );

  return NextResponse.json({ mapping: saved, syncResult });
}
