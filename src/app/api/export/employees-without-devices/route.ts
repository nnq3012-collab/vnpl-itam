import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getEmployeesWithoutDevices } from "@/lib/employees-without-devices";
import { spreadsheetResponse } from "@/lib/spreadsheet";

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

  return spreadsheetResponse(
    rows,
    "EmployeesWithoutDevices",
    `employees-without-devices-${new Date().toISOString().slice(0, 10)}`,
    format
  );
}
