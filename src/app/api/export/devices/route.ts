import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { buildDeviceWhere } from "@/lib/device-filters";
import { STATUS_LABELS } from "@/lib/statuses";
import { spreadsheetResponse } from "@/lib/spreadsheet";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "csv" ? "csv" : "xlsx";

  const where = await buildDeviceWhere((k) => params.getAll(k));

  const devices = await prisma.device.findMany({
    where,
    include: { deviceType: true, location: true, assignedUser: true, vendor: true, batches: true },
    orderBy: { assetId: "asc" },
  });

  const rows = devices.map((d) => ({
    "Asset ID": d.assetId,
    "Device Type": d.deviceType.name,
    "Make/Model": d.makeModel ?? "",
    CPU: d.cpu ?? "",
    RAM: d.ram ?? "",
    Storage: d.storage ?? "",
    "Serial Number": d.serialNumber ?? "",
    Status: STATUS_LABELS[d.status],
    Center: d.location.center,
    Department: d.location.department,
    "Assigned User": d.assignedUser?.fullName ?? "Unassigned",
    "Assigned Email": d.assignedUserEmail ?? "",
    Batch: d.batches.map((b) => b.name).join(", "),
    Vendor: d.vendor?.name ?? "",
    Price: d.price != null ? Number(d.price) : "",
    "Purchase Year": d.purchaseYear ?? "",
    "Date Registered": d.dateRegistered.toISOString().slice(0, 10),
    "Last Updated": d.lastUpdated.toISOString().slice(0, 10),
  }));

  return spreadsheetResponse(rows, "DeviceMaster", `device-master-export-${new Date().toISOString().slice(0, 10)}`, format);
}
