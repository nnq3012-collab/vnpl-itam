import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { EmployeeStatus, Prisma } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const status = typeof body?.status === "string" ? body.status : undefined;

  if (!employeeId || !fullName) {
    return NextResponse.json({ error: "Employee ID and Full Name are required" }, { status: 400 });
  }
  if (status && !Object.values(EmployeeStatus).includes(status as EmployeeStatus)) {
    return NextResponse.json({ error: "Invalid Status" }, { status: 400 });
  }

  let locationId: string | null | undefined = undefined;
  if (center || department) {
    if (!center || !department) {
      return NextResponse.json({ error: "Both Center and Department are required together" }, { status: 400 });
    }
    const location = await prisma.location.findUnique({ where: { center_department: { center, department } } });
    if (!location) return NextResponse.json({ error: "Invalid Center/Department combination" }, { status: 400 });
    locationId = location.id;
  } else if ("center" in body || "department" in body) {
    locationId = null; // explicitly cleared
  }

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        employeeId,
        fullName,
        email,
        ...(locationId !== undefined ? { locationId } : {}),
        ...(status ? { status: status as EmployeeStatus } : {}),
      },
      include: { location: true },
    });
    return NextResponse.json({ employee });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: `Employee ID "${employeeId}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFeature("reference.employeesAndLocations");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  try {
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete — this employee still has devices assigned to them" },
        { status: 409 }
      );
    }
    throw e;
  }
}
