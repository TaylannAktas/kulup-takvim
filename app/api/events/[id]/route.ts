import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clubEvents, eventStatus } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";
import { computeConflicts } from "@/lib/calendar/conflict-detection";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    startAt: z.iso.datetime({ offset: true }).optional(),
    endAt: z.iso.datetime({ offset: true }).optional(),
    isAllDay: z.boolean().optional(),
    status: z.enum(eventStatus.enumValues).optional(),
    location: z.string().nullable().optional(),
    expectedAttendance: z.number().int().min(0).nullable().optional(),
    colorOverride: z.string().nullable().optional(),
    /** İyimser kilit jetonu — istemcinin elindeki sürümün `updated_at`'i (spec §7.4). */
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/**
 * PATCH /api/events/[id]
 *
 * İYİMSER EŞZAMANLILIK (spec §7.4 — "son yazan kazanmasın"):
 * İstemci, düzenlemeye başladığı sürümün `updated_at` değerini `expectedUpdatedAt`
 * olarak geri gönderir. Sunucudaki değer farklıysa 409 + güncel kayıt döner;
 * istemci farkı gösterip yeniden dener. Sessiz üzerine yazma yok.
 *
 * Karşılaştırma milisaniye hassasiyetinde `getTime()` ile yapılıyor: Postgres
 * timestamptz mikrosaniye tutsa da sürücü her okumada JS `Date`'e (ms) indiriyor,
 * yani istemcinin gördüğü ISO dizesi ile burada okunan değer aynı hassasiyette.
 * Bu yüzden kontrolü SQL'in WHERE'ine taşımıyoruz — orada mikrosaniyeli gerçek
 * değerle karşılaştırılırdı ve hiçbir zaman eşleşmezdi.
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

  const [existing] = await db.select().from(clubEvents).where(eq(clubEvents.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  const expected = new Date(parsed.data.expectedUpdatedAt);
  if (expected.getTime() !== existing.updatedAt.getTime()) {
    return NextResponse.json({ error: "conflict", current: existing }, { status: 409 });
  }

  const patch = parsed.data;
  const startAt = patch.startAt ? new Date(patch.startAt) : existing.startAt;
  const endAt = patch.endAt ? new Date(patch.endAt) : existing.endAt;
  if (endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json(
      { error: { formErrors: [], fieldErrors: { endAt: ["Bitiş zamanı başlangıçtan sonra olmalı."] } } },
      { status: 400 }
    );
  }

  // Ucuz olduğu için koşulsuz yeniden hesaplanıyor (sadece tarih/durum
  // değiştiğinde değil) — tek bir sorgu kümesi, küçük tablolar.
  const conflictFlags = await computeConflicts({ startAt, endAt }, id);

  // Alanlar tek tek yazılıyor: `parsed.data`'yı olduğu gibi yaymak
  // `expectedUpdatedAt`'i de (var olmayan bir sütun) SET'e taşırdı.
  const [updated] = await db
    .update(clubEvents)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.isAllDay !== undefined && { isAllDay: patch.isAllDay }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.location !== undefined && { location: patch.location }),
      ...(patch.expectedAttendance !== undefined && {
        expectedAttendance: patch.expectedAttendance,
      }),
      ...(patch.colorOverride !== undefined && { colorOverride: patch.colorOverride }),
      startAt,
      endAt,
      conflictFlags,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(clubEvents.id, id))
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "update",
    entityType: "club_event",
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ event: updated });
}

/**
 * DELETE /api/events/[id]
 * İyimser kilit kontrolü yok: silme kararı admin/editor'ün nihai kararıdır
 * (spec §7.4 yalnızca düzenleme-düzenleme yarışını adresliyor).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  const [existing] = await db.select().from(clubEvents).where(eq(clubEvents.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  await logAudit({
    userId: session.user.id,
    action: "delete",
    entityType: "club_event",
    entityId: id,
    before: existing,
  });

  await db.delete(clubEvents).where(eq(clubEvents.id, id));

  return new NextResponse(null, { status: 204 });
}
