import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIT } from "@/lib/api-guard";
import { Prisma } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireIT();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  if (!center || !department) {
    return NextResponse.json({ error: "Center and Department are required" }, { status: 400 });
  }

  try {
    const location = await prisma.location.update({ where: { id }, data: { center, department } });
    return NextResponse.json({ location });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "This Center/Department combination already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireIT();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  try {
    await prisma.location.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete — one or more devices are still assigned to this location" },
        { status: 409 }
      );
    }
    throw e;
  }
}
