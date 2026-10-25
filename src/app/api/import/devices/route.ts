import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { AuditAction, Prisma } from "@prisma/client";
import { normalizeStatus } from "@/lib/import-helpers";

type ImportRow = {
  assetId: string;
  deviceType: string;
  makeModel?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  serialNumber?: string;
  status?: string;
  center: string;
  department: string;
  assignedUserEmail?: string;
  assignedUserName?: string;
};

export async function POST(request: NextRequest) {
  const guard = await requireFeature("import.devices");
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 400 });

  const skipped: { assetId: string; reason: string }[] = [];

  // Look up everything the rows reference once, up front, instead of
  // several queries per row.
  const [existingDevices, employees] = await Promise.all([
    prisma.device.findMany({
      where: { assetId: { in: rows.map((r) => r.assetId?.trim()).filter(Boolean) } },
      select: { assetId: true },
    }),
    prisma.employee.findMany({ select: { id: true, fullName: true, email: true } }),
  ]);
  const takenAssetIds = new Set(existingDevices.map((d) => d.assetId));
  const employeeByEmail = new Map<string, (typeof employees)[number]>();
  const employeeByName = new Map<string, (typeof employees)[number]>();
  for (const e of employees) {
    if (e.email && !employeeByEmail.has(e.email.toLowerCase())) employeeByEmail.set(e.email.toLowerCase(), e);
    if (!employeeByName.has(e.fullName)) employeeByName.set(e.fullName, e);
  }

  const valid: { row: ImportRow; assetId: string; deviceTypeName: string; center: string; department: string }[] = [];
  for (const row of rows) {
    const assetId = row.assetId?.trim();
    const deviceTypeName = row.deviceType?.trim();
    const center = row.center?.trim();
    const department = row.department?.trim();

    if (!assetId || !deviceTypeName || !center || !department) {
      skipped.push({ assetId: assetId || "(blank)", reason: "Missing required field (Asset ID / Device Type / Center / Department)" });
      continue;
    }
    if (takenAssetIds.has(assetId)) {
      skipped.push({ assetId, reason: "Asset ID already exists" });
      continue;
    }
    takenAssetIds.add(assetId); // a repeat later in the same file is skipped too
    valid.push({ row, assetId, deviceTypeName, center, department });
  }

  // Device Types and Locations named in the file are created if missing.
  const typeNames = [...new Set(valid.map((v) => v.deviceTypeName))];
  const locationPairs = [...new Map(valid.map((v) => [`${v.center}\u0000${v.department}`, { center: v.center, department: v.department }])).values()];
  await prisma.$transaction([
    prisma.deviceType.createMany({ data: typeNames.map((name) => ({ name })), skipDuplicates: true }),
    prisma.location.createMany({ data: locationPairs, skipDuplicates: true }),
  ]);
  const [deviceTypes, locations] = await Promise.all([
    prisma.deviceType.findMany({ where: { name: { in: typeNames } }, select: { id: true, name: true } }),
    prisma.location.findMany({ where: { OR: locationPairs }, select: { id: true, center: true, department: true } }),
  ]);
  const typeIdByName = new Map(deviceTypes.map((t) => [t.name, t.id]));
  const locationIdByPair = new Map(locations.map((l) => [`${l.center}\u0000${l.department}`, l.id]));

  const devices: Prisma.DeviceCreateManyInput[] = [];
  const logs: Prisma.AuditLogCreateManyInput[] = [];
  for (const { row, assetId, deviceTypeName, center, department } of valid) {
    const emailHint = row.assignedUserEmail?.trim().toLowerCase();
    const nameHint = row.assignedUserName?.trim();
    const employee =
      (emailHint && employeeByEmail.get(emailHint)) ||
      (nameHint && nameHint.toLowerCase() !== "unassigned" && employeeByName.get(nameHint)) ||
      null;
    const status = normalizeStatus(row.status);

    devices.push({
      assetId,
      deviceTypeId: typeIdByName.get(deviceTypeName)!,
      makeModel: row.makeModel?.trim() || null,
      cpu: row.cpu?.trim() || null,
      ram: row.ram?.trim() || null,
      storage: row.storage?.trim() || null,
      serialNumber: row.serialNumber?.trim() || null,
      status,
      locationId: locationIdByPair.get(`${center}\u0000${department}`)!,
      assignedUserId: employee?.id ?? null,
      assignedUserEmail: employee?.email ?? null,
    });
    logs.push({
      assetId,
      action: AuditAction.BULK_IMPORT,
      previousState: "N/A - Bulk Import",
      newState: `${status} @ ${center} / ${department} — ${employee ? nameHint || employee.email : "Unassigned"}`,
      operator: guard.session.fullName,
      reason: null,
    });
  }

  // Devices and their log entries are written together or not at all.
  await prisma.$transaction([
    prisma.device.createMany({ data: devices }),
    prisma.auditLog.createMany({ data: logs }),
  ]);

  return NextResponse.json({ imported: devices.length, skipped });
}
