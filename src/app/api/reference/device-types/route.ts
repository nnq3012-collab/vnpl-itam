import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";

export async function GET() {
  const guard = await requireFeature("reference.deviceTypesAndVendors");
  if ("error" in guard) return guard.error;
  const deviceTypes = await prisma.deviceType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ deviceTypes });
}

export async function POST(request: NextRequest) {
  const guard = await requireFeature("reference.deviceTypesAndVendors");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const hasSpecs = !!body?.hasSpecs;
  const depreciationMonths =
    typeof body?.depreciationMonths === "number" && body.depreciationMonths > 0
      ? Math.round(body.depreciationMonths)
      : null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await prisma.deviceType.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });

  const deviceType = await prisma.deviceType.create({ data: { name, hasSpecs, depreciationMonths } });
  return NextResponse.json({ deviceType }, { status: 201 });
}
