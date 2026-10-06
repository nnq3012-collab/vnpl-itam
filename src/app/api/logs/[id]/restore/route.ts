import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canDeleteDevices } from "@/lib/rbac";
import { restoreDeletedDevice } from "@/lib/device-deletion";

// Restoring is gated like deleting: only accounts that may delete devices.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteDevices(session.username)) {
    return NextResponse.json({ error: "Forbidden — only accounts that can delete devices can restore them" }, { status: 403 });
  }

  const { id } = await params;
  const error = await restoreDeletedDevice(id, session.fullName);
  if (error) return NextResponse.json({ error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
