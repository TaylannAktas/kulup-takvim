import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicCalendarEntries } from "@/lib/db/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(academicCalendarEntries)
    .where(eq(academicCalendarEntries.isActive, true));

  return NextResponse.json({ entries: rows });
}
