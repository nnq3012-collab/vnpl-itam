import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { Prisma } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFeature("devices.bulkEdit");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const batch = await prisma.batch.update({ where: { id }, data: { name } });
    return NextResponse.json({ batch });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

// Deleting a batch only unlinks its devices (the join rows cascade); the
// devices themselves and their "added to batch" history entries stay.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFeature("devices.bulkEdit");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  await prisma.batch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
