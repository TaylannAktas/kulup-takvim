import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const facultyCode = searchParams.get("facultyCode");
  const examType = searchParams.get("examType");

  const filters = [eq(examSessions.isActive, true)];
  if (facultyCode) filters.push(eq(examSessions.facultyCode, facultyCode));
  if (examType) filters.push(eq(examSessions.examType, examType as "arasinav" | "final" | "mazeret"));

  const rows = await db
    .select()
    .from(examSessions)
    .where(and(...filters));

  return NextResponse.json({ sessions: rows });
}
