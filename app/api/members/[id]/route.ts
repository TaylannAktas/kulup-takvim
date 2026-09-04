import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { members, memberCategory } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  displayName: z.string().min(1).optional(),
  category: z.enum(memberCategory.enumValues).optional(),
  facultyCode: z.string().nullable().optional(),
  programName: z.string().nullable().optional(),
  classYear: z.string().nullable().optional(),
  courseCodes: z.array(z.string()).nullable().optional(),
});

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

  const [existing] = await db.select().from(members).where(eq(members.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  const patch = parsed.data;
  const [updated] = await db
    .update(members)
    .set({
      ...(patch.displayName !== undefined && { displayName: patch.displayName }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.facultyCode !== undefined && { facultyCode: patch.facultyCode }),
      ...(patch.programName !== undefined && { programName: patch.programName }),
      ...(patch.classYear !== undefined && { classYear: patch.classYear }),
      ...(patch.courseCodes !== undefined && { courseCodes: patch.courseCodes }),
    })
    .where(eq(members.id, id))
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "update",
    entityType: "member",
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role === "viewer") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  const [existing] = await db.select().from(members).where(eq(members.id, id));
  if (!existing) {
    return new NextResponse(null, { status: 404 });
  }

  await logAudit({
    userId: session.user.id,
    action: "delete",
    entityType: "member",
    entityId: id,
    before: existing,
  });

  await db.delete(members).where(eq(members.id, id));

  return new NextResponse(null, { status: 204 });
}
