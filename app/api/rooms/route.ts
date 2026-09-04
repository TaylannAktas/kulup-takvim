import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";

/**
 * Derslikler (spec §7.3 boş derslik bulucu için kaynak veri). Kod listesi
 * ders programı içe aktarmasından "türetilebilir" ama kapasite/bina bilgisi
 * elle girilmesi gereken bir meta veri — bu yüzden CRUD admin/editor'e açık,
 * okuma herkese açık.
 */

export async function GET() {
  const rows = await db.select().from(rooms);
  return NextResponse.json({ rooms: rows });
}

const upsertSchema = z.object({
  code: z.string().min(1),
  building: z.string().nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
});

/** POST: yeni derslik ekler veya var olanın bina/kapasite bilgisini günceller. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db.select().from(rooms).where(eq(rooms.code, parsed.data.code));

  const [saved] = existing
    ? await db
        .update(rooms)
        .set({ building: parsed.data.building, capacity: parsed.data.capacity })
        .where(eq(rooms.code, parsed.data.code))
        .returning()
    : await db
        .insert(rooms)
        .values({
          code: parsed.data.code,
          building: parsed.data.building ?? null,
          capacity: parsed.data.capacity ?? null,
        })
        .returning();

  return NextResponse.json({ room: saved }, { status: existing ? 200 : 201 });
}
