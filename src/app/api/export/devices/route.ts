import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { DeviceStatus, Prisma } from "@prisma/client";
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

  const where: Prisma.DeviceWhereInput = {};
  const assetId = params.get("assetId");
  const status = params.get("status");
  const center = params.get("center");
  const department = params.get("department");
  const deviceTypeId = params.get("deviceTypeId");
  const assignedUserId = params.get("assignedUserId");

  if (assetId) where.assetId = { contains: assetId };
  if (status) where.status = status as DeviceStatus;
  if (deviceTypeId) where.deviceTypeId = deviceTypeId;
  if (assignedUserId) where.assignedUserId = assignedUserId === "UNASSIGNED" ? null : assignedUserId;
  if (center || department) {
    where.location = { ...(center ? { center } : {}), ...(department ? { department } : {}) };
  }

  const devices = await prisma.device.findMany({
    where,
    include: { deviceType: true, location: true, assignedUser: true },
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
    "Date Registered": d.dateRegistered.toISOString().slice(0, 10),
    "Last Updated": d.lastUpdated.toISOString().slice(0, 10),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const filename = `device-master-export-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return new NextResponse(csv, {
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
