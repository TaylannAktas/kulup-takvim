import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { academicCalendarEntries, academicCalendarCategory } from "@/lib/db/schema";

const patchSchema = z.object({
  categoryOverride: z.enum(academicCalendarCategory.enumValues).nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Bir akademik takvim kaydının türünü elle değiştirir (spec §4.1 override).
 * viewer bu işlemi yapamaz; admin/editor yapabilir.
 *
 * TODO(Faz 3): audit_log'a yazılacak — denetim kaydı altyapısı henüz kurulmadı.
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

  const [updated] = await db
    .update(academicCalendarEntries)
    .set({ categoryOverride: parsed.data.categoryOverride })
    .where(eq(academicCalendarEntries.id, id))
    .returning();

  if (!updated) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({ entry: updated });
}
