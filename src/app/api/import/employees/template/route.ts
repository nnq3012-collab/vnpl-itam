import { NextResponse } from "next/server";
import { requireITorHR } from "@/lib/api-guard";
import * as XLSX from "xlsx";

export async function GET() {
  const guard = await requireITorHR();
  if ("error" in guard) return guard.error;

  const rows = [
    {
      "Employee ID": "EMP999",
      "Full Name": "Nguyen Van Vi Du",
      Email: "vidu.nguyen@vnpost.vn",
      Center: "Back Office",
      Department: "Phòng Công nghệ và Đổi mới sáng tạo",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employee-import-template.xlsx"',
    },
  });
}
