import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getEmployeesWithoutDevices } from "@/lib/employees-without-devices";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "csv" ? "csv" : "xlsx";
  const center = params.get("center") || undefined;

  const employees = await getEmployeesWithoutDevices(center);
  const rows = employees.map((e) => ({
    "Employee ID": e.employeeId,
    "Full Name": e.fullName,
    Email: e.email ?? "",
    Center: e.location?.center ?? "",
    Department: e.location?.department ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const filename = `employees-without-devices-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "csv") {
    // BOM so Excel opens the CSV as UTF-8 (Vietnamese names otherwise garble).
    return new NextResponse(String.fromCharCode(0xfeff) + XLSX.utils.sheet_to_csv(worksheet), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "EmployeesWithoutDevices");
  return new NextResponse(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
