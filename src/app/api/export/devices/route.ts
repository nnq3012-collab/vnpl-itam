import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { DeviceStatus } from "@prisma/client";
import { buildDeviceWhere } from "@/lib/device-filters";
import * as XLSX from "xlsx";

const STATUS_LABELS: Record<DeviceStatus, string> = {
  IN_STOCK: "In Stock",
  DEPLOYED: "Deployed",
  IN_REPAIR: "In Repair",
  LOST: "Lost",
  STOLEN: "Stolen",
  BROKEN: "Broken",
  RETIRED: "Retired",
};

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

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const filename = `device-master-export-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    // BOM so Excel opens the CSV as UTF-8 (Vietnamese names otherwise garble).
    return new NextResponse(String.fromCharCode(0xfeff) + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DeviceMaster");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
