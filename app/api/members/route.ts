import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { members, memberCategory } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";

/**
 * Üyeler ve hedef kitle (spec §7.2 uygunluk analizi için kaynak veri).
 * Otomatik türetme yok — CSV içe aktarma da dahil manuel CRUD (spec §7.2:
 * "bir Google Form'dan CSV içe aktarma desteği olsun" — bu, tarayıcıda CSV'yi
 * satır satır bu POST ucuna göndermekle karşılanabilir, ayrı bir dosya
 * yükleme/ayrıştırma ucu gerekmiyor).
 */

export async function GET() {
  const rows = await db.select().from(members);
  return NextResponse.json({ members: rows });
}

const createSchema = z.object({
  displayName: z.string().min(1),
  category: z.enum(memberCategory.enumValues),
  facultyCode: z.string().optional(),
  programName: z.string().optional(),
  classYear: z.string().optional(),
  courseCodes: z.array(z.string()).optional(),
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
    .insert(members)
    .values({
      displayName: parsed.data.displayName,
      category: parsed.data.category,
      facultyCode: parsed.data.facultyCode ?? null,
      programName: parsed.data.programName ?? null,
      classYear: parsed.data.classYear ?? null,
      courseCodes: parsed.data.courseCodes ?? null,
    })
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "create",
    entityType: "member",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ member: created }, { status: 201 });
}
