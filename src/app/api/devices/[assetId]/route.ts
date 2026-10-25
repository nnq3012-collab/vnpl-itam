import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AuditAction, DeviceStatus, EmployeeStatus } from "@prisma/client";
import { canDeleteDevices } from "@/lib/rbac";
import { canUseFeature } from "@/lib/feature-access";
import { REASON_REQUIRED_STATUSES } from "@/lib/statuses";
import { priceOrNull, recordChange, textOrNull, yearOrNull } from "@/lib/device-changes";
import { deleteDeviceWithSnapshot } from "@/lib/device-deletion";

const TEXT_FIELDS = [
  ["makeModel", "Make/Model"],
  ["cpu", "CPU"],
  ["ram", "RAM"],
  ["storage", "Storage"],
  ["serialNumber", "Serial Number"],
] as const;

const ASSIGN_FIELDS =["assignedUserId", "employeeStatus"] as const;

const EDIT_FIELDS = [
  "deviceTypeId",
  "makeModel",
  "cpu",
  "ram",
  "storage",
  "serialNumber",
  "status",
  "center",
  "department",
  "vendorId",
  "price",
  "purchaseYear",
] as const;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteDevices(session.username)) {
    return NextResponse.json({ error: "Forbidden — you do not have permission to delete devices" }, { status: 403 });
  }

  const { assetId } = await params;
  if (!(await deleteDeviceWithSnapshot(assetId, session.fullName))) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [canEditAll, canAssign] = await Promise.all([
    canUseFeature(session.role, "devices.edit"),
    canUseFeature(session.role, "devices.assign"),
  ]);
  if (!canEditAll && !canAssign) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { assetId } = await params;
  const device = await prisma.device.findUnique({
    where: { assetId },
    include: { deviceType: true, location: true, assignedUser: true, vendor: true },
  });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const disallowed = [
    ...(canEditAll ? [] : EDIT_FIELDS),
    ...(canAssign ? [] : ASSIGN_FIELDS),
  ].filter((f) => f in body);
  if (disallowed.length > 0) {
    return NextResponse.json(
      { error: `Your role is not allowed to change: ${disallowed.join(", ")}` },
      { status: 403 }
    );
  }

  const changes: string[] = [];
  const deviceUpdate: Record<string, unknown> = {};

  // --- Device fields (devices.edit) ---
  if (canEditAll) {
    if (typeof body.deviceTypeId === "string" && body.deviceTypeId !== device.deviceTypeId) {
      const dt = await prisma.deviceType.findUnique({ where: { id: body.deviceTypeId } });
      if (!dt) return NextResponse.json({ error: "Invalid Device Type" }, { status: 400 });
      deviceUpdate.deviceTypeId = body.deviceTypeId;
      changes.push(`Device Type: ${device.deviceType.name} → ${dt.name}`);
    }
    // Blank input is stored as null, so compare after normalizing — otherwise
    // "" vs null logs a no-op "— → —" change on every save.
    for (const [key, label] of TEXT_FIELDS) {
      if (key in body) recordChange(deviceUpdate, changes, key, label, device[key], textOrNull(body[key]));
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
      if (REASON_REQUIRED_STATUSES.includes(body.status) && !reason) {
        return NextResponse.json(
          { error: "Reason is required when setting Status to Lost, Stolen, Broken, or Retired" },
          { status: 400 }
        );
      }
      deviceUpdate.status = body.status;
      changes.push(`Status: ${device.status} → ${body.status}`);
    }
    if ("vendorId" in body) {
      const newVendorId: string | null = body.vendorId || null;
      if (newVendorId !== device.vendorId) {
        let newVendorName = "—";
        if (newVendorId) {
          const vendor = await prisma.vendor.findUnique({ where: { id: newVendorId } });
          if (!vendor) return NextResponse.json({ error: "Invalid Vendor" }, { status: 400 });
          newVendorName = vendor.name;
        }
        deviceUpdate.vendorId = newVendorId;
        changes.push(`Vendor: ${device.vendor?.name ?? "—"} → ${newVendorName}`);
      }
    }
    if ("price" in body) {
      const before = device.price == null ? null : Number(device.price);
      recordChange(deviceUpdate, changes, "price", "Price", before, priceOrNull(body.price));
    }
    if ("purchaseYear" in body) {
      recordChange(deviceUpdate, changes, "purchaseYear", "Purchase Year", device.purchaseYear, yearOrNull(body.purchaseYear));
    }
  }

  // --- Assigned User (devices.assign) ---
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
      const wasAssigned = !!device.assignedUserId;
      const isNowAssigned = !!newAssignedUserId;
      if (!wasAssigned && isNowAssigned) {
        changes.push(`Allocation: Unassigned → ${newEmployeeName}`);
      } else if (wasAssigned && !isNowAssigned) {
        changes.push(`Return: ${device.assignedUser?.fullName ?? "Unassigned"} → Unassigned`);
      } else {
        changes.push(`Reassignment: ${device.assignedUser?.fullName ?? "Unassigned"} → ${newEmployeeName}`);
      }
      assignedUserChanged = true;
    }
  }

  // --- Employee Status (devices.assign) — applies to whichever employee ends up assigned ---
  let employeeStatusUpdate: { id: string; status: EmployeeStatus } | null = null;
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
      employeeStatusUpdate = { id: targetEmployeeId, status: body.employeeStatus as EmployeeStatus };
      changes.push(`Employee Status (${employee.fullName}): ${employee.status} → ${body.employeeStatus}`);
    }
  }

  if (Object.keys(deviceUpdate).length === 0 && changes.length === 0) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  let action: AuditAction = AuditAction.LIFECYCLE_UPDATE;
  if ("status" in deviceUpdate) action = AuditAction.LIFECYCLE_UPDATE;
  else if (assignedUserChanged) action = AuditAction.REASSIGNMENT;
  else if (["deviceTypeId", "makeModel", "cpu", "ram", "storage", "serialNumber"].some((k) => k in deviceUpdate))
    action = AuditAction.HARDWARE_CHANGE;

  // Employee status, device, and its log entry are written together or not at all.
  const updatedDevice = await prisma.$transaction(async (tx) => {
    if (employeeStatusUpdate) {
      await tx.employee.update({ where: { id: employeeStatusUpdate.id }, data: { status: employeeStatusUpdate.status } });
    }
    const updated =
      Object.keys(deviceUpdate).length > 0
        ? await tx.device.update({
            where: { id: device.id },
            data: deviceUpdate,
            include: { deviceType: true, location: true, assignedUser: true, vendor: true },
          })
        : device;
    await tx.auditLog.create({
      data: {
        assetId: device.assetId,
        action,
        previousState: `Before: ${device.status} — ${device.assignedUser?.fullName ?? "Unassigned"}`,
        newState: changes.join("; "),
        operator: session.fullName,
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
      },
    });
    return updated;
  });

  return NextResponse.json({ device: updatedDevice });
}
