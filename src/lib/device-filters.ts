import { DeviceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fold, matchesSearch } from "@/lib/search";

/** Ids of devices whose Asset ID, serial, make/model, or assigned user
 * (name, employee ID, email) match `q` — case- and accent-insensitive.
 * ponytail: matched in JS over all devices since Postgres `contains` can't
 * ignore Vietnamese accents; fine to a few thousand devices, switch to the
 * unaccent extension + raw SQL beyond that. */
async function deviceIdsMatching(q: string): Promise<string[]> {
  const devices = await prisma.device.findMany({
    select: {
      id: true,
      assetId: true,
      serialNumber: true,
      makeModel: true,
      assignedUserEmail: true,
      assignedUser: { select: { fullName: true, employeeId: true, email: true } },
    },
  });
  return devices
    .filter((d) =>
      matchesSearch(q, [
        d.assetId,
        d.serialNumber,
        d.makeModel,
        d.assignedUserEmail,
        d.assignedUser?.fullName,
        d.assignedUser?.employeeId,
        d.assignedUser?.email,
      ])
    )
    .map((d) => d.id);
}

/** Exact (accented) names of employees matching `q`, for searching log text
 * that embeds names — lets "nguyen khac hai" find "Nguyễn Khắc Hải". */
export async function employeeNamesMatching(q: string): Promise<string[]> {
  if (!fold(q).trim()) return [];
  const employees = await prisma.employee.findMany({ select: { fullName: true, employeeId: true, email: true } });
  return employees.filter((e) => matchesSearch(q, [e.fullName, e.employeeId, e.email])).map((e) => e.fullName);
}

/** Builds the Device Master `where` from query params. `q` is the free-text
 * search (`assetId` is still accepted from older links). Every filter except
 * search and Assigned User accepts multiple values (repeated params,
 * e.g. ?deviceTypeId=a&deviceTypeId=b) and matches ANY of them. Status also
 * accepts a comma list, which dashboard tile links use. Shared by the page
 * and the export route so an export always matches what's on screen. */
export async function buildDeviceWhere(get: (key: string) => string[]): Promise<Prisma.DeviceWhereInput> {
  const where: Prisma.DeviceWhereInput = {};
  const [q] = [...get("q"), ...get("assetId")].filter((v) => v.trim());
  const [assignedUserId] = get("assignedUserId");
  const statuses = get("status")
    .flatMap((s) => s.split(","))
    .filter((s): s is DeviceStatus => s in DeviceStatus);
  const deviceTypeIds = get("deviceTypeId").filter(Boolean);
  const centers = get("center").filter(Boolean);
  const departments = get("department").filter(Boolean);
  const batchIds = get("batchId").filter(Boolean);

  if (q) where.id = { in: await deviceIdsMatching(q) };
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

/** Case-insensitive log search over Asset ID, Before/Details text, operator
 * and reason. Employee names typed without accents are expanded to their
 * exact spelling first, since log text embeds names with accents. */
export async function auditLogSearchWhere(q: string): Promise<Prisma.AuditLogWhereInput> {
  const term = q.trim();
  const fields = ["assetId", "previousState", "newState", "operator", "reason"] as const;
  // Employee names only ever appear in the Before/Details text, so expanded
  // names are matched there only.
  // ponytail: still one ILIKE pair per matching name — a common word ("nguyen")
  // expands to many; switch to the unaccent extension if log search gets slow.
  const names = await employeeNamesMatching(q);
  return {
    OR: [
      ...fields.map((f) => ({ [f]: { contains: term, mode: "insensitive" as const } })),
      ...names.flatMap((n) => [
        { previousState: { contains: n, mode: "insensitive" as const } },
        { newState: { contains: n, mode: "insensitive" as const } },
      ]),
    ],
  };
}
