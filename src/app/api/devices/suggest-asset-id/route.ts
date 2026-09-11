import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Looks at existing Asset IDs for the given Device Type, finds the most
// common "letters + digits" prefix pattern (e.g. LAP001, LAP002 -> "LAP"),
// and suggests the next number in that sequence, zero-padded to match.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deviceTypeId = request.nextUrl.searchParams.get("deviceTypeId");
  if (!deviceTypeId) return NextResponse.json({ suggestedId: null });

  const devices = await prisma.device.findMany({
    where: { deviceTypeId },
    select: { assetId: true },
  });

  const pattern = /^([A-Za-z]+)(\d+)$/;
  const byPrefix = new Map<string, { max: number; width: number; count: number }>();

  for (const d of devices) {
    const match = d.assetId.match(pattern);
    if (!match) continue;
    const [, prefix, digits] = match;
    const num = parseInt(digits, 10);
    const entry = byPrefix.get(prefix);
    if (!entry) {
      byPrefix.set(prefix, { max: num, width: digits.length, count: 1 });
    } else {
      entry.count++;
      if (num > entry.max) {
        entry.max = num;
        entry.width = digits.length;
      }
    }
  }

  if (byPrefix.size === 0) {
    return NextResponse.json({ suggestedId: null });
  }

  // Use whichever prefix is used by the most existing devices of this type.
  const [bestPrefix, best] = Array.from(byPrefix.entries()).sort((a, b) => b[1].count - a[1].count)[0];

  const nextNum = best.max + 1;
  const suggestedId = `${bestPrefix}${String(nextNum).padStart(best.width, "0")}`;

  return NextResponse.json({ suggestedId });
}
