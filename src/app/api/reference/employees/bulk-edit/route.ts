import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { EmployeeStatus } from "@prisma/client";

/** Sets the same Status and/or Center/Department on many employees. Only
 * fields present in the body change; everything else stays per employee. */
export async function POST(request: NextRequest) {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((i: unknown) => typeof i === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Select at least one employee" }, { status: 400 });

  const data: { status?: EmployeeStatus; locationId?: string } = {};
  if ("status" in body) {
    if (!Object.values(EmployeeStatus).includes(body.status)) {
      return NextResponse.json({ error: "Invalid Status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if ("center" in body || "department" in body) {
    const location =
      typeof body.center === "string" && typeof body.department === "string"
        ? await prisma.location.findUnique({ where: { center_department: { center: body.center, department: body.department } } })
        : null;
    if (!location) return NextResponse.json({ error: "Pick a valid Center and Department" }, { status: 400 });
    data.locationId = location.id;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update — turn on at least one field" }, { status: 400 });
  }

  const { count } = await prisma.employee.updateMany({ where: { id: { in: ids } }, data });
  const employees = await prisma.employee.findMany({ where: { id: { in: ids } }, include: { location: true } });
  return NextResponse.json({ updated: count, employees });
}
