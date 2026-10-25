import { requireFeature } from "@/lib/api-guard";
import { spreadsheetResponse } from "@/lib/spreadsheet";

export async function GET() {
  const guard = await requireFeature("import.employees");
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

  return spreadsheetResponse(rows, "Users", "employee-import-template");
}
