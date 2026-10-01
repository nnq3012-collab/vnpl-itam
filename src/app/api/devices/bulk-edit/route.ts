import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { AuditAction, DeviceStatus } from "@prisma/client";

const REASON_REQUIRED_STATUSES: DeviceStatus[] = [
  DeviceStatus.LOST,
  DeviceStatus.STOLEN,
  DeviceStatus.BROKEN,
  DeviceStatus.RETIRED,
];

export async function POST(request: NextRequest) {
  const guard = await requireFeature("devices.bulkEdit");
  if ("error" in guard) return guard.error;
  const { session } = guard;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds.filter((a: unknown) => typeof a === "string") : [];
  if (assetIds.length === 0) {
    return NextResponse.json({ error: "Select at least one device" }, { status: 400 });
  }

  const fieldsInBody = ["status", "makeModel", "center", "department", "vendorId", "price", "purchaseYear", "batchName"].filter(
    (f) => f in body
  );
  if (fieldsInBody.length === 0) {
    return NextResponse.json({ error: "No fields to update — turn on at least one field" }, { status: 400 });
  }

  // --- Validate shared inputs once, before touching any device ---
  let sharedLocationId: string | null = null;
  if (typeof body.center === "string" && typeof body.department === "string") {
    const location = await prisma.location.findUnique({
      where: { center_department: { center: body.center, department: body.department } },
    });
    if (!location) return NextResponse.json({ error: "Invalid Center/Department combination" }, { status: 400 });
    sharedLocationId = location.id;
  } else if ("center" in body || "department" in body) {
    return NextResponse.json({ error: "Center and Department must be set together" }, { status: 400 });
  }

  let sharedVendorName = "—";
  if ("vendorId" in body && body.vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId } });
    if (!vendor) return NextResponse.json({ error: "Invalid Vendor" }, { status: 400 });
    sharedVendorName = vendor.name;
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (typeof body.status === "string") {
    if (!Object.values(DeviceStatus).includes(body.status as DeviceStatus)) {
      return NextResponse.json({ error: "Invalid Status" }, { status: 400 });
    }
    if (REASON_REQUIRED_STATUSES.includes(body.status as DeviceStatus) && !reason) {
      return NextResponse.json(
        { error: "Reason is required when setting Status to Lost, Stolen, Broken, or Retired" },
        { status: 400 }
      );
    }
  }

  // Batch: "add" creates the batch on first use; "remove" needs it to exist.
  let batch: { id: string; name: string } | null = null;
  const batchRemove = body.batchMode === "remove";
  if ("batchName" in body) {
    const batchName = typeof body.batchName === "string" ? body.batchName.trim() : "";
    if (!batchName) return NextResponse.json({ error: "Batch name is required" }, { status: 400 });
    batch = batchRemove
      ? await prisma.batch.findUnique({ where: { name: batchName } })
      : await prisma.batch.upsert({ where: { name: batchName }, update: {}, create: { name: batchName } });
    if (!batch) return NextResponse.json({ error: `No batch named "${batchName}"` }, { status: 400 });
  }

  const devices = await prisma.device.findMany({
    where: { assetId: { in: assetIds } },
    include: { deviceType: true, location: true, assignedUser: true, vendor: true, batches: { select: { id: true } } },
  });
  if (devices.length === 0) {
    return NextResponse.json({ error: "No matching devices found" }, { status: 404 });
  }

  const operations: ReturnType<typeof prisma.device.update>[] = [];
  const auditOperations: ReturnType<typeof prisma.auditLog.create>[] = [];
  let changedCount = 0;

  for (const device of devices) {
    const deviceUpdate: Record<string, unknown> = {};
    const changes: string[] = [];

    if ("makeModel" in body && body.makeModel !== device.makeModel) {
      deviceUpdate.makeModel = body.makeModel || null;
      changes.push(`Make/Model: ${device.makeModel ?? "—"} → ${body.makeModel || "—"}`);
    }
    if (sharedLocationId && sharedLocationId !== device.locationId) {
      deviceUpdate.locationId = sharedLocationId;
      changes.push(`Location: ${device.location.center}/${device.location.department} → ${body.center}/${body.department}`);
    }
    if (typeof body.status === "string" && body.status !== device.status) {
      deviceUpdate.status = body.status;
      changes.push(`Status: ${device.status} → ${body.status}`);
    }
    if ("vendorId" in body) {
      const newVendorId: string | null = body.vendorId || null;
      if (newVendorId !== device.vendorId) {
        deviceUpdate.vendorId = newVendorId;
        changes.push(`Vendor: ${device.vendor?.name ?? "—"} → ${newVendorId ? sharedVendorName : "—"}`);
      }
    }
    if ("price" in body) {
      const newPrice = typeof body.price === "number" && body.price >= 0 ? body.price : null;
      if (newPrice !== (device.price ? Number(device.price) : null)) {
        deviceUpdate.price = newPrice;
        changes.push(`Price: ${device.price ?? "—"} → ${newPrice ?? "—"}`);
      }
    }
    if ("purchaseYear" in body) {
      const newPurchaseYear =
        typeof body.purchaseYear === "number" && Number.isInteger(body.purchaseYear) ? body.purchaseYear : null;
      if (newPurchaseYear !== device.purchaseYear) {
        deviceUpdate.purchaseYear = newPurchaseYear;
        changes.push(`Purchase Year: ${device.purchaseYear ?? "—"} → ${newPurchaseYear ?? "—"}`);
      }
    }

    if (batch) {
      const inBatch = device.batches.some((b) => b.id === batch.id);
      if (batchRemove && inBatch) {
        deviceUpdate.batches = { disconnect: { id: batch.id } };
        changes.push(`Batch: removed from ${batch.name}`);
      } else if (!batchRemove && !inBatch) {
        deviceUpdate.batches = { connect: { id: batch.id } };
        changes.push(`Batch: added to ${batch.name}`);
      }
    }

    if (changes.length === 0) continue;
    changedCount += 1;

    operations.push(
      prisma.device.update({
        where: { id: device.id },
        data: deviceUpdate,
      })
    );

    let action: AuditAction = AuditAction.LIFECYCLE_UPDATE;
    if ("status" in deviceUpdate) action = AuditAction.LIFECYCLE_UPDATE;
    else if ("makeModel" in deviceUpdate) action = AuditAction.HARDWARE_CHANGE;
    else if (Object.keys(deviceUpdate).length === 1 && "batches" in deviceUpdate) action = AuditAction.BATCH;

    auditOperations.push(
      prisma.auditLog.create({
        data: {
          assetId: device.assetId,
          action,
          previousState: `Before: ${device.status} — Bulk edit`,
          newState: changes.join("; "),
          operator: session.fullName,
          reason: reason || null,
        },
      })
    );
  }

  if (operations.length === 0) {
    return NextResponse.json({ error: "No devices needed changes — values already match" }, { status: 400 });
  }

  await prisma.$transaction([...operations, ...auditOperations]);

  return NextResponse.json({ updated: changedCount, skipped: devices.length - changedCount });
}
