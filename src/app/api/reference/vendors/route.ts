import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const guard = await requireFeature("reference.deviceTypesAndVendors");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const vendor = await prisma.vendor.create({ data: { name } });
    return NextResponse.json({ vendor }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });
    }
    throw e;
  }
}
