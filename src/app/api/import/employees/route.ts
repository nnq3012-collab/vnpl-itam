import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";

type ImportRow = {
  employeeId: string;
  fullName: string;
  email?: string;
  center?: string;
  department?: string;
};

export async function POST(request: NextRequest) {
  const guard = await requireFeature("import.employees");
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
    const centerText = row.center?.trim() || null;
    const departmentText = row.department?.trim() || null;

    let locationId: string | null = null;

    if (centerText && departmentText) {
      // Center + Department both given — exact, unambiguous match.
      const location = await prisma.location.findUnique({
        where: { center_department: { center: centerText, department: departmentText } },
      });
      if (location) {
        locationId = location.id;
      } else {
        results.unresolvedDepartments.add(`${centerText} / ${departmentText}`);
      }
    } else if (departmentText) {
      // Only Department given — fall back to matching by Department alone,
      // but only when that Department is unambiguous (exists under exactly
      // one Center). Otherwise leave unresolved rather than guessing.
      const matches = await prisma.location.findMany({ where: { department: departmentText } });
      if (matches.length === 1) {
        locationId = matches[0].id;
      } else if (matches.length === 0) {
        results.unresolvedDepartments.add(departmentText);
      } else {
        results.unresolvedDepartments.add(`${departmentText} (ambiguous — exists under multiple Centers, add a Center column to resolve)`);
      }
    }

    const existing = await prisma.employee.findUnique({ where: { employeeId } });
    if (existing) {
      // Name/Email are refreshed from the file; Status is deliberately left
      // untouched so HR's Active/Resigned/Transferred flags survive
      // re-imports of a stale roster export. Location is only overwritten
      // when this row resolved to a valid one — a blank/unresolved location
      // in the file never wipes an employee's existing location.
      await prisma.employee.update({
        where: { employeeId },
        data: { fullName, email, ...(locationId ? { locationId } : {}) },
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
