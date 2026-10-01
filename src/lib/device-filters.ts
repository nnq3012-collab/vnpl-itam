import { DeviceStatus, Prisma } from "@prisma/client";

/** Builds the Device Master `where` from query params. Every filter except
 * Asset ID and Assigned User accepts multiple values (repeated params,
 * e.g. ?deviceTypeId=a&deviceTypeId=b) and matches ANY of them. Status also
 * accepts a comma list, which dashboard tile links use. Shared by the page
 * and the export route so an export always matches what's on screen. */
export function buildDeviceWhere(get: (key: string) => string[]): Prisma.DeviceWhereInput {
  const where: Prisma.DeviceWhereInput = {};
  const [assetId] = get("assetId");
  const [assignedUserId] = get("assignedUserId");
  const statuses = get("status")
    .flatMap((s) => s.split(","))
    .filter((s): s is DeviceStatus => s in DeviceStatus);
  const deviceTypeIds = get("deviceTypeId").filter(Boolean);
  const centers = get("center").filter(Boolean);
  const departments = get("department").filter(Boolean);
  const batchIds = get("batchId").filter(Boolean);

  if (assetId) where.assetId = { contains: assetId };
  if (statuses.length) where.status = { in: statuses };
  if (deviceTypeIds.length) where.deviceTypeId = { in: deviceTypeIds };
  if (assignedUserId) where.assignedUserId = assignedUserId === "UNASSIGNED" ? null : assignedUserId;
  if (centers.length || departments.length) {
    where.location = {
      ...(centers.length ? { center: { in: centers } } : {}),
      ...(departments.length ? { department: { in: departments } } : {}),
    };
  }
  if (batchIds.length) where.batches = { some: { id: { in: batchIds } } };
  return where;
}
