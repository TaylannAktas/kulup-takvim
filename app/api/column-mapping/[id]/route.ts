import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteColumnMapping } from "@/lib/scrapers/exam-schedule/column-mapping";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await params;
  await deleteColumnMapping(id);
  return new NextResponse(null, { status: 204 });
}
