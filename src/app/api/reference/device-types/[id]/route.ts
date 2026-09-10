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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const hasSpecs = !!body?.hasSpecs;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const deviceType = await prisma.deviceType.update({ where: { id }, data: { name, hasSpecs } });
    return NextResponse.json({ deviceType });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });
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
    await prisma.deviceType.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete — one or more devices still use this Device Type" },
        { status: 409 }
      );
    }
    throw e;
  }
}
