import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canDeleteDevices } from "@/lib/rbac";
import { deleteDeviceWithSnapshot } from "@/lib/device-deletion";

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
    if (await deleteDeviceWithSnapshot(assetId, session.fullName)) deleted++;
    else skipped.push(assetId);
  }

  return NextResponse.json({ deleted, skipped });
}
