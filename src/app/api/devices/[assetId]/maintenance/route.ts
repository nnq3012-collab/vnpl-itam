import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { AuditAction } from "@prisma/client";
import { formatMaintenanceDescription, MAINTENANCE_CATEGORIES } from "@/lib/audit-log-display";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const guard = await requireFeature("devices.maintenance");
  if ("error" in guard) return guard.error;

  const { assetId } = await params;
  const device = await prisma.device.findUnique({ where: { assetId } });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (category && !(MAINTENANCE_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const log = await prisma.auditLog.create({
    data: {
      assetId: device.assetId,
      action: AuditAction.MAINTENANCE,
      previousState: null,
      newState: formatMaintenanceDescription(category, description),
      operator: guard.session.fullName,
      reason: null,
    },
  });

  return NextResponse.json({ log }, { status: 201 });
}
