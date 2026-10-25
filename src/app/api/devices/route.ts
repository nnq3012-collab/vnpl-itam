import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { AuditAction, DeviceStatus } from "@prisma/client";
import { priceOrNull, textOrNull, yearOrNull } from "@/lib/device-changes";

export async function POST(request: NextRequest) {
  const guard = await requireFeature("devices.register");
  if ("error" in guard) return guard.error;
  const { session } = guard;

  const body = await request.json().catch(() => null);
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  const deviceTypeId = typeof body?.deviceTypeId === "string" ? body.deviceTypeId : "";
  const makeModel = textOrNull(body?.makeModel);
  const cpu = textOrNull(body?.cpu);
  const ram = textOrNull(body?.ram);
  const storage = textOrNull(body?.storage);
  const serialNumber = textOrNull(body?.serialNumber);
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const assignedUserId = typeof body?.assignedUserId === "string" && body.assignedUserId ? body.assignedUserId : null;
  const vendorId = typeof body?.vendorId === "string" && body.vendorId ? body.vendorId : null;
  const price = priceOrNull(body?.price);
  const purchaseYear = yearOrNull(body?.purchaseYear);

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

  if (vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return NextResponse.json({ error: "Invalid Vendor" }, { status: 400 });
    }
  }

  // Device and its registration log entry are written together or not at all.
  const device = await prisma.$transaction(async (tx) => {
    const created = await tx.device.create({
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
        vendorId,
        price,
        purchaseYear,
      },
      include: { deviceType: true, location: true, assignedUser: true },
    });

    await tx.auditLog.create({
      data: {
        assetId: created.assetId,
        action: AuditAction.INITIAL_REGISTRATION,
        previousState: "N/A - New Asset",
        newState: `In Stock @ ${location.center} / ${location.department} — ${created.assignedUser?.fullName ?? "Unassigned"}`,
        operator: session.fullName,
        reason: null,
      },
    });
    return created;
  });

  return NextResponse.json({ device }, { status: 201 });
}
