import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { fetchExamScheduleFrameset, parseExamScheduleUrl } from "@/lib/scrapers/exam-schedule/fetch";
import { extractTableRows } from "@/lib/scrapers/exam-schedule/parse";
import { detectExamColumnMapping } from "@/lib/scrapers/exam-schedule/column-mapping";

const bodySchema = z.object({ rootUrl: z.string().url() });

const PREVIEW_ROW_LIMIT = 15;

/**
 * Elle sütun eşleme ekranı için: kaynağı bir kez çeker, yapısal tespiti dener
 * ve önizleme için ilk birkaç satırı döner. Veri yazmaz — sadece admin'in
 * eşlemeyi elle kurabilmesi için ham malzeme sağlar (spec §4.2).
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

  const urlInfo = parseExamScheduleUrl(parsed.data.rootUrl);
  if (!urlInfo) {
    return NextResponse.json(
      { error: "URL, dersprogramiyukle.atilim.edu.tr/{donem+tur}/{fakulte} desenine uymuyor." },
      { status: 400 }
    );
  }

  try {
    const { sheetHtml, sheetUrl } = await fetchExamScheduleFrameset(parsed.data.rootUrl);
    const rows = extractTableRows(sheetHtml);
    const detection = detectExamColumnMapping(rows);

    return NextResponse.json({
      sheetUrl,
      urlInfo,
      rows: rows.slice(0, PREVIEW_ROW_LIMIT),
      totalRows: rows.length,
      detection,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
