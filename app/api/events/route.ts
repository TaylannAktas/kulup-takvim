import { NextRequest, NextResponse } from "next/server";
import { and, asc, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clubEvents, eventStatus } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";
import { computeConflicts } from "@/lib/calendar/conflict-detection";

/**
 * Kulüp etkinlikleri (spec §4.5, §7.1/3). Okuma her oturum açmış kullanıcıya
 * açık; yazma admin/editor'e (spec §2.2 roller tablosu — viewer salt okunur).
 */

export const dynamic = "force-dynamic";

const rangeSchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

/**
 * GET /api/events?from=ISO&to=ISO
 * Aralık verilirse o aralıkla KESİŞEN etkinlikler döner (sınırda dokunma
 * kesişme sayılmaz — `conflict-detection.ts`'teki kuralla aynı). Verilmezse
 * iptal edilmemiş tüm etkinlikler döner; tek bir kulübün veri kümesi küçük
 * olduğu için üst sınır konmadı.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const parsed = rangeSchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const filters = [ne(clubEvents.status, "iptal")];
  if (parsed.data.to) filters.push(lt(clubEvents.startAt, new Date(parsed.data.to)));
  if (parsed.data.from) filters.push(gt(clubEvents.endAt, new Date(parsed.data.from)));

  const rows = await db
    .select()
    .from(clubEvents)
    .where(and(...filters))
    .orderBy(asc(clubEvents.startAt));

  return NextResponse.json({ events: rows });
}

const createSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
    isAllDay: z.boolean().optional().default(false),
    status: z.enum(eventStatus.enumValues).optional().default("fikir"),
    location: z.string().optional(),
    expectedAttendance: z.number().int().min(0).optional(),
    colorOverride: z.string().optional(),
  })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    message: "Bitiş zamanı başlangıçtan sonra olmalı.",
    path: ["endAt"],
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

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);

  // Kaydetmeyi engellemiyoruz — çakışma bir uyarıdır, yasak değil (spec §4.5).
  const conflictFlags = await computeConflicts({ startAt, endAt });

  const [created] = await db
    .insert(clubEvents)
    .values({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startAt,
      endAt,
      isAllDay: parsed.data.isAllDay,
      status: parsed.data.status,
      location: parsed.data.location ?? null,
      expectedAttendance: parsed.data.expectedAttendance ?? null,
      colorOverride: parsed.data.colorOverride ?? null,
      conflictFlags,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    })
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "create",
    entityType: "club_event",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ event: created }, { status: 201 });
}
