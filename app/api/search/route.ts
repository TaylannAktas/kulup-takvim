import { NextRequest, NextResponse } from "next/server";
import { ne, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clubEvents, examSessions, academicCalendarEntries } from "@/lib/db/schema";
import { toClubTime } from "@/lib/calendar/date-utils";

export type SearchResultItem = {
  type: "event" | "exam" | "academic";
  id: string;
  label: string;
  detail: string;
  /** Takvimi bu ay/güne götürmek için. */
  month: string;
  day: string;
};

function monthAndDay(date: Date): { month: string; day: string } {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return { month: `${y}-${m}`, day: `${y}-${m}-${d}` };
}

const RESULT_LIMIT_PER_TYPE = 8;

/**
 * Cmd/Ctrl+K arama (spec §7.1: ders kodu, sınav, etkinlik, akademik takvim
 * kaydı). Küçük veri kümesi (bkz. DECISIONS.md) — tüm aktif kayıtları çekip
 * bellekte metin eşleştirmesi yapmak, ayrı bir arama motoru kurmaktan daha
 * basit ve bu ölçekte yeterli.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [events, exams, academic] = await Promise.all([
    db.select().from(clubEvents).where(ne(clubEvents.status, "iptal")),
    db.select().from(examSessions).where(eq(examSessions.isActive, true)),
    db.select().from(academicCalendarEntries).where(eq(academicCalendarEntries.isActive, true)),
  ]);

  const results: SearchResultItem[] = [];

  for (const row of events) {
    if (results.filter((r) => r.type === "event").length >= RESULT_LIMIT_PER_TYPE) break;
    if (!row.title.toLowerCase().includes(q)) continue;
    const { month, day } = monthAndDay(toClubTime(row.startAt));
    results.push({ type: "event", id: row.id, label: row.title, detail: "Etkinlik", month, day });
  }

  for (const row of exams) {
    if (results.filter((r) => r.type === "exam").length >= RESULT_LIMIT_PER_TYPE) break;
    const haystack = `${row.courseCode ?? ""} ${row.courseName ?? ""}`.toLowerCase();
    if (!haystack.includes(q) || !row.examDate) continue;
    const { month, day } = monthAndDay(row.examDate);
    results.push({
      type: "exam",
      id: row.id,
      label: row.courseCode ?? row.courseName ?? "Sınav",
      detail: `Sınav · ${row.facultyCode}`,
      month,
      day,
    });
  }

  for (const row of academic) {
    if (results.filter((r) => r.type === "academic").length >= RESULT_LIMIT_PER_TYPE) break;
    if (!row.description.toLowerCase().includes(q)) continue;
    const anchor = row.startDate ?? row.endDate;
    if (!anchor) continue;
    const { month, day } = monthAndDay(anchor);
    results.push({
      type: "academic",
      id: row.id,
      label: row.description,
      detail: "Akademik Takvim",
      month,
      day,
    });
  }

  return NextResponse.json({ results });
}
