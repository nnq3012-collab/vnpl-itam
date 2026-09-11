import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { Prisma } from "@prisma/client";

export async function GET() {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;
  const locations = await prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] });
  return NextResponse.json({ locations });
}

export async function POST(request: NextRequest) {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  if (!center || !department) {
    return NextResponse.json({ error: "Center and Department are required" }, { status: 400 });
  }

  try {
    const location = await prisma.location.create({ data: { center, department } });
    return NextResponse.json({ location }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "This Center/Department combination already exists" }, { status: 409 });
    }
    throw e;
  }
}
