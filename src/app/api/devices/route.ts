import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageDevices } from "@/lib/rbac";
import { AuditAction, DeviceStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canManageDevices(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  const deviceTypeId = typeof body?.deviceTypeId === "string" ? body.deviceTypeId : "";
  const makeModel = typeof body?.makeModel === "string" ? body.makeModel.trim() : null;
  const cpu = typeof body?.cpu === "string" && body.cpu.trim() ? body.cpu.trim() : null;
  const ram = typeof body?.ram === "string" && body.ram.trim() ? body.ram.trim() : null;
  const storage = typeof body?.storage === "string" && body.storage.trim() ? body.storage.trim() : null;
  const serialNumber = typeof body?.serialNumber === "string" ? body.serialNumber.trim() : null;
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const assignedUserId = typeof body?.assignedUserId === "string" && body.assignedUserId ? body.assignedUserId : null;

  if (!assetId || !deviceTypeId || !center || !department) {
    return NextResponse.json(
      { error: "Asset ID, Device Type, Center, and Department are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.device.findUnique({ where: { assetId } });
  if (existing) {
    return NextResponse.json(
      { error: `Asset ID "${assetId}" already exists. Use Update Device instead.` },
      { status: 409 }
    );
  }

  const deviceType = await prisma.deviceType.findUnique({ where: { id: deviceTypeId } });
  if (!deviceType) {
    return NextResponse.json({ error: "Invalid Device Type" }, { status: 400 });
  }

  const location = await prisma.location.findUnique({
    where: { center_department: { center, department } },
  });
  if (!location) {
    return NextResponse.json({ error: "Invalid Center/Department combination" }, { status: 400 });
  }

  let assignedUserEmail: string | null = null;
  if (assignedUserId) {
    const employee = await prisma.employee.findUnique({ where: { id: assignedUserId } });
    if (!employee) {
      return NextResponse.json({ error: "Invalid Assigned User" }, { status: 400 });
    }
    assignedUserEmail = employee.email;
  }

  const device = await prisma.device.create({
    data: {
      assetId,
      deviceTypeId,
      makeModel,
      cpu,
      ram,
      storage,
      serialNumber,
      status: DeviceStatus.IN_STOCK,
      locationId: location.id,
      assignedUserId,
      assignedUserEmail,
    },
    include: { deviceType: true, location: true, assignedUser: true },
  });

  await prisma.auditLog.create({
    data: {
      assetId: device.assetId,
      action: AuditAction.INITIAL_REGISTRATION,
      previousState: "N/A - New Asset",
      newState: `In Stock @ ${location.center} / ${location.department} — ${device.assignedUser?.fullName ?? "Unassigned"}`,
      operator: session.fullName,
      reason: null,
    },
  });

  return NextResponse.json({ device }, { status: 201 });
}
