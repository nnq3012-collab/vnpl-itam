import { AuditAction, Prisma, type Device } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DeviceSnapshot = Omit<Device, "price" | "dateRegistered" | "lastUpdated"> & {
  price: string | null;
  dateRegistered: string;
  lastUpdated: string;
  batchIds: string[];
};

/** Deletes a device and writes a DELETION log holding the full row, so it can
 * be restored later from the Activity Log. Used by single and bulk delete. */
export async function deleteDeviceWithSnapshot(assetId: string, operator: string): Promise<boolean> {
  const device = await prisma.device.findUnique({
    where: { assetId },
    include: { location: true, assignedUser: true, batches: { select: { id: true } } },
  });
  if (!device) return false;

  const { location, assignedUser, batches, ...row } = device;
  const snapshot: DeviceSnapshot = {
    ...row,
    price: row.price?.toString() ?? null,
    dateRegistered: row.dateRegistered.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
    batchIds: batches.map((b) => b.id),
  };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        assetId: device.assetId,
        action: AuditAction.DELETION,
        previousState: `${device.status} @ ${location.center} / ${location.department} — ${assignedUser?.fullName ?? "Unassigned"}`,
        newState: "Deleted",
        operator,
        snapshot: snapshot as unknown as Prisma.InputJsonObject,
      },
    }),
    prisma.device.delete({ where: { id: device.id } }),
  ]);
  return true;
}

/** Recreates a deleted device from its DELETION log. References that no
 * longer exist (employee, vendor, batches) are dropped rather than blocking
 * the restore; Device Type and Location are required. Returns an error
 * message, or null on success. */
export async function restoreDeletedDevice(logId: string, operator: string): Promise<string | null> {
  const log = await prisma.auditLog.findUnique({ where: { id: logId } });
  if (!log || log.action !== AuditAction.DELETION || !log.snapshot) {
    return "This log entry can't be restored (only deletions recorded after the Activity Log was added can be).";
  }
  const snap = log.snapshot as unknown as DeviceSnapshot;

  if (await prisma.device.findUnique({ where: { assetId: snap.assetId } })) {
    return `A device with Asset ID "${snap.assetId}" already exists.`;
  }
  const laterRestore = await prisma.auditLog.findFirst({
    where: { assetId: snap.assetId, action: AuditAction.RESTORE, timestamp: { gt: log.timestamp } },
  });
  if (laterRestore) return "This deletion was already restored.";

  const [deviceType, location, employee, vendor, batches] = await Promise.all([
    prisma.deviceType.findUnique({ where: { id: snap.deviceTypeId } }),
    prisma.location.findUnique({ where: { id: snap.locationId } }),
    snap.assignedUserId ? prisma.employee.findUnique({ where: { id: snap.assignedUserId } }) : null,
    snap.vendorId ? prisma.vendor.findUnique({ where: { id: snap.vendorId } }) : null,
    prisma.batch.findMany({ where: { id: { in: snap.batchIds } }, select: { id: true } }),
  ]);
  if (!deviceType) return "Its Device Type no longer exists — re-create the type first.";
  if (!location) return "Its Center/Department no longer exists — re-create the location first.";

  const dropped = [
    snap.assignedUserId && !employee ? "assigned employee" : null,
    snap.vendorId && !vendor ? "vendor" : null,
    batches.length < snap.batchIds.length ? "some batches" : null,
  ].filter(Boolean);

  await prisma.$transaction([
    prisma.device.create({
      data: {
        id: snap.id,
        assetId: snap.assetId,
        deviceTypeId: snap.deviceTypeId,
        makeModel: snap.makeModel,
        cpu: snap.cpu,
        ram: snap.ram,
        storage: snap.storage,
        serialNumber: snap.serialNumber,
        status: snap.status,
        locationId: snap.locationId,
        assignedUserId: employee ? snap.assignedUserId : null,
        assignedUserEmail: employee ? snap.assignedUserEmail : null,
        price: snap.price,
        purchaseYear: snap.purchaseYear,
        vendorId: vendor ? snap.vendorId : null,
        dateRegistered: new Date(snap.dateRegistered),
        batches: { connect: batches },
      },
    }),
    prisma.auditLog.create({
      data: {
        assetId: snap.assetId,
        action: AuditAction.RESTORE,
        previousState: "Deleted",
        newState: `Restored from deletion of ${log.timestamp.toISOString().slice(0, 10)}${dropped.length ? ` (no longer exists, not restored: ${dropped.join(", ")})` : ""}`,
        operator,
      },
    }),
  ]);
  return null;
}
