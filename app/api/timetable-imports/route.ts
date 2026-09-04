import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { timetableImports } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";
import { importTimetable } from "@/lib/timetable-import/normalize";
import { TimetableStructureError } from "@/lib/timetable-import/parse-svg-timetable";
import { validateUploadedFile } from "@/lib/timetable-import/validate";

/**
 * Ders programı içe aktarmaları (spec §4.3).
 *
 * edupage.org'a HİÇBİR otomatik istek atılmaz; tek girdi kullanıcının kendi
 * tarayıcısından kaydedip yüklediği dosyadır.
 */

export const dynamic = "force-dynamic";

/** GET /api/timetable-imports — her oturum açmış kullanıcı; en yeni önce. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const rows = await db
    .select()
    .from(timetableImports)
    .orderBy(desc(timetableImports.uploadedAt));

  return NextResponse.json({ imports: rows });
}

/** POST /api/timetable-imports — multipart/form-data, `file` alanı zorunlu. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "İstek multipart/form-data olmalı." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "`file` alanı zorunlu." }, { status: 400 });
  }

  const validation = validateUploadedFile({
    size: file.size,
    type: file.type,
    name: file.name,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const sourceLabelRaw = form.get("sourceLabel");
  const termCodeRaw = form.get("termCode");
  const sourceLabel =
    typeof sourceLabelRaw === "string" && sourceLabelRaw.trim()
      ? sourceLabelRaw.trim()
      : file.name;
  const termCode =
    typeof termCodeRaw === "string" && termCodeRaw.trim() ? termCodeRaw.trim() : undefined;

  const html = await file.text();

  let result;
  try {
    result = await importTimetable({
      html,
      uploadedBy: session.user.id,
      sourceLabel,
      termCode,
    });
  } catch (error) {
    if (error instanceof TimetableStructureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  await logAudit({
    userId: session.user.id,
    action: "create",
    entityType: "timetable_import",
    entityId: result.importId,
    after: {
      sourceLabel,
      termCode: termCode ?? null,
      parsedSessionCount: result.parsedSessionCount,
    },
  });

  return NextResponse.json(result, { status: 201 });
}
