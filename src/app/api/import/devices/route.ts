import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { AuditAction } from "@prisma/client";
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

  const results = { imported: 0, skipped: [] as { assetId: string; reason: string }[] };

  for (const row of rows) {
    const assetId = row.assetId?.trim();
    const deviceTypeName = row.deviceType?.trim();
    const center = row.center?.trim();
    const department = row.department?.trim();

    if (!assetId || !deviceTypeName || !center || !department) {
      results.skipped.push({ assetId: assetId || "(blank)", reason: "Missing required field (Asset ID / Device Type / Center / Department)" });
      continue;
    }

    const existing = await prisma.device.findUnique({ where: { assetId } });
    if (existing) {
      results.skipped.push({ assetId, reason: "Asset ID already exists" });
      continue;
    }

    const deviceType = await prisma.deviceType.upsert({
      where: { name: deviceTypeName },
      update: {},
      create: { name: deviceTypeName },
    });

    const location = await prisma.location.upsert({
      where: { center_department: { center, department } },
      update: {},
      create: { center, department },
    });

    let assignedUserId: string | null = null;
    let assignedUserEmail: string | null = null;
    const emailHint = row.assignedUserEmail?.trim().toLowerCase();
    const nameHint = row.assignedUserName?.trim();
    if (emailHint) {
      const byEmail = await prisma.employee.findFirst({ where: { email: { equals: emailHint } } });
      if (byEmail) {
        assignedUserId = byEmail.id;
        assignedUserEmail = byEmail.email;
      }
    }
    if (!assignedUserId && nameHint && nameHint.toLowerCase() !== "unassigned") {
      const byName = await prisma.employee.findFirst({ where: { fullName: nameHint } });
      if (byName) {
        assignedUserId = byName.id;
        assignedUserEmail = byName.email;
      }
    }

    const status = normalizeStatus(row.status);

    const device = await prisma.device.create({
      data: {
        assetId,
        deviceTypeId: deviceType.id,
        makeModel: row.makeModel?.trim() || null,
        cpu: row.cpu?.trim() || null,
        ram: row.ram?.trim() || null,
        storage: row.storage?.trim() || null,
        serialNumber: row.serialNumber?.trim() || null,
        status,
        locationId: location.id,
        assignedUserId,
        assignedUserEmail,
      },
    });

    await prisma.auditLog.create({
      data: {
        assetId: device.assetId,
        action: AuditAction.BULK_IMPORT,
        previousState: "N/A - Bulk Import",
        newState: `${status} @ ${center} / ${department} — ${assignedUserId ? nameHint ?? assignedUserEmail : "Unassigned"}`,
        operator: guard.session.fullName,
        reason: null,
      },
    });

    results.imported++;
  }

  return NextResponse.json(results);
}
