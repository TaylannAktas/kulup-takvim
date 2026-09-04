import { NextRequest, NextResponse } from "next/server";
import { and, asc, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clubEvents } from "@/lib/db/schema";
import { generateIcsCalendar, type IcsEventInput } from "@/lib/export/ics";

/**
 * Export club events as RFC 5545 iCalendar (.ics) format.
 * Accessible to any authenticated user (read-only export, same access level as GET /api/events).
 * Optional date range filtering via ?from=ISO&to=ISO query params.
 */

export const dynamic = "force-dynamic";

const rangeSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

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

  // Build filters: exclude cancelled events, and optionally filter by date range
  // (same overlap logic as GET /api/events)
  const filters = [ne(clubEvents.status, "iptal")];
  if (parsed.data.to) filters.push(lt(clubEvents.startAt, new Date(parsed.data.to)));
  if (parsed.data.from) filters.push(gt(clubEvents.endAt, new Date(parsed.data.from)));

  const rows = await db
    .select()
    .from(clubEvents)
    .where(and(...filters))
    .orderBy(asc(clubEvents.startAt));

  // Map database rows to IcsEventInput
  const icsEvents: IcsEventInput[] = rows.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    isAllDay: event.isAllDay,
    location: event.location,
  }));

  const icsContent = generateIcsCalendar(icsEvents, "Kulüp Takvimi");

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kulup-takvimi.ics"',
    },
  });
}
