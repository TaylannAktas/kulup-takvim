import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseSessions } from "@/lib/db/schema";

/**
 * Ders oturumları (edupage içe aktarmadan gelir). Boş derslik bulucu ve
 * ders programı paneli bunu kullanır.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const importId = searchParams.get("importId");
  const room = searchParams.get("room");
  const weekday = searchParams.get("weekday");

  const filters = [];
  if (importId) filters.push(eq(courseSessions.importId, importId));
  if (room) filters.push(eq(courseSessions.room, room));
  if (weekday) filters.push(eq(courseSessions.weekday, Number(weekday)));

  const rows = await db
    .select()
    .from(courseSessions)
    .where(filters.length > 0 ? and(...filters) : undefined);

  return NextResponse.json({ sessions: rows });
}
