import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/api-guard";
import * as XLSX from "xlsx";

export async function GET() {
  const guard = await requireFeature("import.devices");
  if ("error" in guard) return guard.error;

  const rows = [
    {
      "Asset ID": "LAP999",
      "Device Type": "Laptop",
      "Make/Model": "Dell Latitude 5420",
      CPU: "Intel Core i5-1135G7",
      RAM: "16GB",
      Storage: "256GB SSD",
      "Serial Number": "SN123456",
      Status: "In Stock",
      Center: "Back Office",
      Department: "Phòng Công nghệ và Đổi mới sáng tạo",
      "Assigned User": "",
      "Assigned Email": "",
    },
    {
      "Asset ID": "MH999",
      "Device Type": "Monitor",
      "Make/Model": "Dell 22-inch Monitor",
      CPU: "",
      RAM: "",
      Storage: "",
      "Serial Number": "SN654321",
      Status: "In Stock",
      Center: "Back Office",
      Department: "Phòng Công nghệ và Đổi mới sáng tạo",
      "Assigned User": "",
      "Assigned Email": "",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DeviceMaster");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="device-import-template.xlsx"',
    },
  });
}
