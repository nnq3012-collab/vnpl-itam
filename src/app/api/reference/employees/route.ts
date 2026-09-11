import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { EmployeeStatus, Prisma } from "@prisma/client";

export async function GET() {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;
  const employees = await prisma.employee.findMany({ include: { location: true }, orderBy: { fullName: "asc" } });
  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const status = typeof body?.status === "string" ? body.status : EmployeeStatus.ACTIVE;

  if (!employeeId || !fullName) {
    return NextResponse.json({ error: "Employee ID and Full Name are required" }, { status: 400 });
  }
  if (!Object.values(EmployeeStatus).includes(status as EmployeeStatus)) {
    return NextResponse.json({ error: "Invalid Status" }, { status: 400 });
  }

  let locationId: string | null = null;
  if (center || department) {
    if (!center || !department) {
      return NextResponse.json({ error: "Both Center and Department are required together" }, { status: 400 });
    }
    const location = await prisma.location.findUnique({ where: { center_department: { center, department } } });
    if (!location) return NextResponse.json({ error: "Invalid Center/Department combination" }, { status: 400 });
    locationId = location.id;
  }

  try {
    const employee = await prisma.employee.create({
      data: { employeeId, fullName, email, locationId, status: status as EmployeeStatus },
      include: { location: true },
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: `Employee ID "${employeeId}" already exists` }, { status: 409 });
    }
    throw e;
  }
}
