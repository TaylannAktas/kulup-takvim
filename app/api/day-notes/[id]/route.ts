import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dayNotes } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";
import { serializeDayNote } from "@/lib/calendar/day-notes";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({ body: z.string().min(1) }).strict();

/** PATCH /api/day-notes/[id] — sadece not metni güncellenir; tarih taşınmaz. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db.select().from(dayNotes).where(eq(dayNotes.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  const [updated] = await db
    .update(dayNotes)
    .set({ body: parsed.data.body, updatedAt: new Date() })
    .where(eq(dayNotes.id, id))
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "update",
    entityType: "day_note",
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ note: serializeDayNote(updated) });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  const [existing] = await db.select().from(dayNotes).where(eq(dayNotes.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  await logAudit({
    userId: session.user.id,
    action: "delete",
    entityType: "day_note",
    entityId: id,
    before: existing,
  });

  await db.delete(dayNotes).where(eq(dayNotes.id, id));

  return new NextResponse(null, { status: 204 });
}
