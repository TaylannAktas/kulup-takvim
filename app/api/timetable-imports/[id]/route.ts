import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { courseSessions, timetableImports } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  sourceLabel: z.string().trim().min(1).max(200).optional(),
  termCode: z.string().trim().max(50).nullable().optional(),
});

/** GET /api/timetable-imports/[id] — kayıt bilgisi + gerçek oturum sayısı. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db.select().from(timetableImports).where(eq(timetableImports.id, id));
  if (!row) {
    return new NextResponse(null, { status: 404 });
  }

  // `parsedSessionCount` yükleme anındaki değer; bu, DB'de ŞU AN duran satır
  // sayısı. İkisi normalde eşit, ayrışırlarsa bu görünür bir sinyal.
  const [{ value: sessionCount }] = await db
    .select({ value: count() })
    .from(courseSessions)
    .where(eq(courseSessions.importId, id));

  return NextResponse.json({ import: row, sessionCount });
}

/**
 * PATCH /api/timetable-imports/[id] — kaynak etiketi ve/veya dönem kodunu
 * sonradan düzenler (kullanıcı isteği, 2026-09-07). Ders oturumlarına
 * dokunmaz, sadece `timetable_imports` satırındaki görünen bilgileri değiştirir.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Değiştirilecek alan yok." }, { status: 400 });
  }

  const [existing] = await db.select().from(timetableImports).where(eq(timetableImports.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  const [updated] = await db
    .update(timetableImports)
    .set(parsed.data)
    .where(eq(timetableImports.id, id))
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "update",
    entityType: "timetable_import",
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ import: updated });
}

/** DELETE /api/timetable-imports/[id] — içe aktarmayı ve derslerini siler. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  const [existing] = await db
    .select()
    .from(timetableImports)
    .where(eq(timetableImports.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  await logAudit({
    userId: session.user.id,
    action: "delete",
    entityType: "timetable_import",
    entityId: id,
    before: existing,
  });

  // `course_sessions.import_id`'de ON DELETE CASCADE YOK — önce çocuk satırlar,
  // sonra ana kayıt. Sıra ters olursa foreign key kısıtı hata verir.
  await db.delete(courseSessions).where(eq(courseSessions.importId, id));
  await db.delete(timetableImports).where(eq(timetableImports.id, id));

  return new NextResponse(null, { status: 204 });
}
