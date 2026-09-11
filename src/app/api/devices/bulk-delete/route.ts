import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canDeleteDevices } from "@/lib/rbac";
import { AuditAction } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteDevices(session.username)) {
    return NextResponse.json({ error: "Forbidden — you do not have permission to delete devices" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const assetIds: string[] = Array.isArray(body?.assetIds) ? body.assetIds : [];
  if (assetIds.length === 0) return NextResponse.json({ error: "No devices selected" }, { status: 400 });

  let deleted = 0;
  const skipped: string[] = [];

  for (const assetId of assetIds) {
    const device = await prisma.device.findUnique({
      where: { assetId },
      include: { deviceType: true, location: true, assignedUser: true },
    });
    if (!device) {
      skipped.push(assetId);
      continue;
    }

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
    deleted++;
  }

  return NextResponse.json({ deleted, skipped });
}
