import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";

export async function GET() {
  const guard = await requireFeature("reference.deviceTypesAndVendors");
  if ("error" in guard) return guard.error;
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ vendors });
}

export async function POST(request: NextRequest) {
  const guard = await requireFeature("reference.deviceTypesAndVendors");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await prisma.vendor.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });

  const vendor = await prisma.vendor.create({ data: { name } });
  return NextResponse.json({ vendor }, { status: 201 });
}
