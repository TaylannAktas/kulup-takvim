import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dayNotes } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";
import { DATE_ONLY_PATTERN, parseDateOnly, serializeDayNote } from "@/lib/calendar/day-notes";

/**
 * Gün notları (spec §4.5 / §7.1). Serbest metin, düşük riskli: çakışma tespiti
 * ve iyimser kilit yok — sadece rol kontrolü + denetim kaydı.
 */

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    date: z.string().regex(DATE_ONLY_PATTERN).optional(),
    from: z.string().regex(DATE_ONLY_PATTERN).optional(),
    to: z.string().regex(DATE_ONLY_PATTERN).optional(),
  })
  .refine((v) => !(v.date && (v.from || v.to)), {
    message: "`date` ile `from`/`to` birlikte kullanılamaz.",
  });

/** GET /api/day-notes?date=YYYY-MM-DD  veya  ?from=&to=  — her oturum açmış kullanıcı. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    date: sp.get("date") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const filters = [];
  if (parsed.data.date) filters.push(eq(dayNotes.date, parseDateOnly(parsed.data.date)));
  if (parsed.data.from) filters.push(gte(dayNotes.date, parseDateOnly(parsed.data.from)));
  if (parsed.data.to) filters.push(lte(dayNotes.date, parseDateOnly(parsed.data.to)));

  const rows = await db
    .select()
    .from(dayNotes)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(dayNotes.date));

  return NextResponse.json({ notes: rows.map(serializeDayNote) });
}

const createSchema = z.object({
  date: z.string().regex(DATE_ONLY_PATTERN, "Tarih YYYY-MM-DD biçiminde olmalı."),
  body: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(dayNotes)
    .values({
      date: parseDateOnly(parsed.data.date),
      body: parsed.data.body,
      createdBy: session.user.id,
    })
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "create",
    entityType: "day_note",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ note: serializeDayNote(created) }, { status: 201 });
}
