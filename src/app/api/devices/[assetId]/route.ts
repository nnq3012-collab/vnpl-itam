import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AuditAction, DeviceStatus, EmployeeStatus, Role } from "@prisma/client";

const REASON_REQUIRED_STATUSES: DeviceStatus[] = [
  DeviceStatus.LOST,
  DeviceStatus.STOLEN,
  DeviceStatus.BROKEN,
  DeviceStatus.RETIRED,
];

const IT_ONLY_FIELDS = [
  "deviceTypeId",
  "makeModel",
  "cpu",
  "ram",
  "storage",
  "serialNumber",
  "status",
  "center",
  "department",
] as const;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.IT) {
    return NextResponse.json({ error: "Forbidden — only IT can delete devices" }, { status: 403 });
  }

  const { assetId } = await params;
  const device = await prisma.device.findUnique({
    where: { assetId },
    include: { deviceType: true, location: true, assignedUser: true },
  });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  await prisma.auditLog.create({
    data: {
      assetId: device.assetId,
      action: AuditAction.LIFECYCLE_UPDATE,
      previousState: `${device.status} @ ${device.location.center} / ${device.location.department} — ${device.assignedUser?.fullName ?? "Unassigned"}`,
      newState: "Deleted",
      operator: session.fullName,
      reason: null,
    },
  });

  await prisma.device.delete({ where: { id: device.id } });

  return NextResponse.json({ ok: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const device = await prisma.device.findUnique({
    where: { assetId },
    include: { deviceType: true, location: true, assignedUser: true },
  });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  return NextResponse.json({ device });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === Role.FINANCE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { assetId } = await params;
  const device = await prisma.device.findUnique({
    where: { assetId },
    include: { deviceType: true, location: true, assignedUser: true },
  });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (session.role === Role.HR) {
    const disallowed = IT_ONLY_FIELDS.filter((f) => f in body);
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `HR can only edit Assigned User and Employee Status. Not allowed: ${disallowed.join(", ")}` },
        { status: 403 }
      );
    }
  }

  const changes: string[] = [];
  const deviceUpdate: Record<string, unknown> = {};

  // --- IT-only device fields ---
  if (session.role === Role.IT) {
    if (typeof body.deviceTypeId === "string" && body.deviceTypeId !== device.deviceTypeId) {
      const dt = await prisma.deviceType.findUnique({ where: { id: body.deviceTypeId } });
      if (!dt) return NextResponse.json({ error: "Invalid Device Type" }, { status: 400 });
      deviceUpdate.deviceTypeId = body.deviceTypeId;
      changes.push(`Device Type: ${device.deviceType.name} → ${dt.name}`);
    }
    if ("makeModel" in body && body.makeModel !== device.makeModel) {
      deviceUpdate.makeModel = body.makeModel || null;
      changes.push(`Make/Model: ${device.makeModel ?? "—"} → ${body.makeModel || "—"}`);
    }
    if ("cpu" in body && body.cpu !== device.cpu) {
      deviceUpdate.cpu = body.cpu || null;
      changes.push(`CPU: ${device.cpu ?? "—"} → ${body.cpu || "—"}`);
    }
    if ("ram" in body && body.ram !== device.ram) {
      deviceUpdate.ram = body.ram || null;
      changes.push(`RAM: ${device.ram ?? "—"} → ${body.ram || "—"}`);
    }
    if ("storage" in body && body.storage !== device.storage) {
      deviceUpdate.storage = body.storage || null;
      changes.push(`Storage: ${device.storage ?? "—"} → ${body.storage || "—"}`);
    }
    if ("serialNumber" in body && body.serialNumber !== device.serialNumber) {
      deviceUpdate.serialNumber = body.serialNumber || null;
      changes.push(`Serial Number: ${device.serialNumber ?? "—"} → ${body.serialNumber || "—"}`);
    }
    if (typeof body.center === "string" && typeof body.department === "string") {
      if (body.center !== device.location.center || body.department !== device.location.department) {
        const location = await prisma.location.findUnique({
          where: { center_department: { center: body.center, department: body.department } },
        });
        if (!location) {
          return NextResponse.json({ error: "Invalid Center/Department combination" }, { status: 400 });
        }
        deviceUpdate.locationId = location.id;
        changes.push(
          `Location: ${device.location.center}/${device.location.department} → ${location.center}/${location.department}`
        );
      }
    }
    if (typeof body.status === "string" && body.status !== device.status) {
      if (!Object.values(DeviceStatus).includes(body.status as DeviceStatus)) {
        return NextResponse.json({ error: "Invalid Status" }, { status: 400 });
      }
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (REASON_REQUIRED_STATUSES.includes(body.status as DeviceStatus) && !reason) {
        return NextResponse.json(
          { error: "Reason is required when setting Status to Lost, Stolen, Broken, or Retired" },
          { status: 400 }
        );
      }
      deviceUpdate.status = body.status;
      changes.push(`Status: ${device.status} → ${body.status}`);
    }
  }

  // --- Assigned User (IT + HR) ---
  let assignedUserChanged = false;
  if ("assignedUserId" in body) {
    const newAssignedUserId: string | null = body.assignedUserId || null;
    if (newAssignedUserId !== device.assignedUserId) {
      let newEmail: string | null = null;
      let newEmployeeName = "Unassigned";
      if (newAssignedUserId) {
        const employee = await prisma.employee.findUnique({ where: { id: newAssignedUserId } });
        if (!employee) return NextResponse.json({ error: "Invalid Assigned User" }, { status: 400 });
        newEmail = employee.email;
        newEmployeeName = employee.fullName;
      }
      deviceUpdate.assignedUserId = newAssignedUserId;
      deviceUpdate.assignedUserEmail = newEmail;
      changes.push(`Assigned User: ${device.assignedUser?.fullName ?? "Unassigned"} → ${newEmployeeName}`);
      assignedUserChanged = true;
    }
  }

  // --- Employee Status (IT + HR) — applies to whichever employee ends up assigned ---
  let employeeStatusChangeNote: string | null = null;
  if (typeof body.employeeStatus === "string") {
    if (!Object.values(EmployeeStatus).includes(body.employeeStatus as EmployeeStatus)) {
      return NextResponse.json({ error: "Invalid Employee Status" }, { status: 400 });
    }
    const targetEmployeeId = "assignedUserId" in body ? body.assignedUserId : device.assignedUserId;
    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: "No employee is assigned to this device — select an Assigned User before setting Employee Status" },
        { status: 400 }
      );
    }
    const employee = await prisma.employee.findUnique({ where: { id: targetEmployeeId } });
    if (!employee) return NextResponse.json({ error: "Invalid Assigned User" }, { status: 400 });
    if (employee.status !== body.employeeStatus) {
      await prisma.employee.update({
        where: { id: targetEmployeeId },
        data: { status: body.employeeStatus },
      });
      employeeStatusChangeNote = `Employee Status (${employee.fullName}): ${employee.status} → ${body.employeeStatus}`;
      changes.push(employeeStatusChangeNote);
    }
  }

  if (Object.keys(deviceUpdate).length === 0 && changes.length === 0) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  const updatedDevice =
    Object.keys(deviceUpdate).length > 0
      ? await prisma.device.update({
          where: { id: device.id },
          data: deviceUpdate,
          include: { deviceType: true, location: true, assignedUser: true },
        })
      : device;

  let action: AuditAction = AuditAction.LIFECYCLE_UPDATE;
  if ("status" in deviceUpdate) action = AuditAction.LIFECYCLE_UPDATE;
  else if (assignedUserChanged) action = AuditAction.REASSIGNMENT;
  else if (["deviceTypeId", "makeModel", "cpu", "ram", "storage", "serialNumber"].some((k) => k in deviceUpdate))
    action = AuditAction.HARDWARE_CHANGE;

  await prisma.auditLog.create({
    data: {
      assetId: device.assetId,
      action,
      previousState: `Before: ${device.status} — ${device.assignedUser?.fullName ?? "Unassigned"}`,
      newState: changes.join("; "),
      operator: session.fullName,
      reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
    },
  });

  return NextResponse.json({ device: updatedDevice });
}
