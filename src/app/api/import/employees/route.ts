import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIT } from "@/lib/api-guard";

type ImportRow = {
  employeeId: string;
  fullName: string;
  email?: string;
  department?: string;
};

export async function POST(request: NextRequest) {
  const guard = await requireIT();
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 400 });

  const results = {
    created: 0,
    updated: 0,
    skipped: [] as { employeeId: string; reason: string }[],
    unresolvedDepartments: new Set<string>(),
  };

  for (const row of rows) {
    const employeeId = row.employeeId?.trim();
    const fullName = row.fullName?.trim();
    if (!employeeId || !fullName) {
      results.skipped.push({ employeeId: employeeId || "(blank)", reason: "Missing Employee ID or Full Name" });
      continue;
    }

    const email = row.email?.trim() || null;
    const departmentText = row.department?.trim() || null;

    // Department names are unique across Centers in this org's Locations
    // list, so we can resolve the pairing without the file specifying Center.
    let locationId: string | null = null;
    if (departmentText) {
      const location = await prisma.location.findFirst({ where: { department: departmentText } });
      if (location) {
        locationId = location.id;
      } else {
        results.unresolvedDepartments.add(departmentText);
      }
    }

    const existing = await prisma.employee.findUnique({ where: { employeeId } });
    if (existing) {
      // Name/Email/location are refreshed from the file; Status is
      // deliberately left untouched so HR's Active/Resigned/Transferred
      // flags survive re-imports of a stale roster export. If the
      // department can't be resolved, leave the existing location alone
      // rather than blanking it.
      await prisma.employee.update({
        where: { employeeId },
        data: { fullName, email, ...(locationId || !departmentText ? { locationId } : {}) },
      });
      results.updated++;
    } else {
      await prisma.employee.create({
        data: { employeeId, fullName, email, locationId },
      });
      results.created++;
    }
  }

  return NextResponse.json({
    created: results.created,
    updated: results.updated,
    skipped: results.skipped,
    unresolvedDepartments: Array.from(results.unresolvedDepartments),
  });
}
