import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/api-guard";
import { Prisma } from "@prisma/client";

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

  // Look up locations and existing employees once, up front, instead of
  // several queries per row.
  const [allLocations, existingEmployees] = await Promise.all([
    prisma.location.findMany({ select: { id: true, center: true, department: true } }),
    prisma.employee.findMany({
      where: { employeeId: { in: rows.map((r) => r.employeeId?.trim()).filter(Boolean) } },
      select: { employeeId: true },
    }),
  ]);
  const locationIdByPair = new Map(allLocations.map((l) => [`${l.center}\u0000${l.department}`, l.id]));
  const locationsByDepartment = new Map<string, string[]>();
  for (const l of allLocations) locationsByDepartment.set(l.department, [...(locationsByDepartment.get(l.department) ?? []), l.id]);
  const existingIds = new Set(existingEmployees.map((e) => e.employeeId));

  // Keyed by Employee ID so a repeat later in the file overrides the earlier row.
  const creates = new Map<string, Prisma.EmployeeCreateManyInput>();
  const updates = new Map<string, Prisma.EmployeeUpdateInput>();

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
      const id = locationIdByPair.get(`${centerText}\u0000${departmentText}`);
      if (id) {
        locationId = id;
      } else {
        results.unresolvedDepartments.add(`${centerText} / ${departmentText}`);
      }
    } else if (departmentText) {
      // Only Department given — fall back to matching by Department alone,
      // but only when that Department is unambiguous (exists under exactly
      // one Center). Otherwise leave unresolved rather than guessing.
      const matches = locationsByDepartment.get(departmentText) ?? [];
      if (matches.length === 1) {
        locationId = matches[0];
      } else if (matches.length === 0) {
        results.unresolvedDepartments.add(departmentText);
      } else {
        results.unresolvedDepartments.add(`${departmentText} (ambiguous — exists under multiple Centers, add a Center column to resolve)`);
      }
    }

    const pendingCreate = creates.get(employeeId);
    if (existingIds.has(employeeId)) {
      // Name/Email are refreshed from the file; Status is deliberately left
      // untouched so HR's Active/Resigned/Transferred flags survive
      // re-imports of a stale roster export. Location is only overwritten
      // when this row resolved to a valid one — a blank/unresolved location
      // in the file never wipes an employee's existing location.
      updates.set(employeeId, {
        ...updates.get(employeeId),
        fullName,
        email,
        ...(locationId ? { location: { connect: { id: locationId } } } : {}),
      });
      results.updated++;
    } else if (pendingCreate) {
      // Repeat of a new employee earlier in the file — same rules as above.
      creates.set(employeeId, { ...pendingCreate, fullName, email, ...(locationId ? { locationId } : {}) });
      results.updated++;
    } else {
      creates.set(employeeId, { employeeId, fullName, email, locationId });
      results.created++;
    }
  }

  await prisma.$transaction([
    prisma.employee.createMany({ data: [...creates.values()] }),
    ...[...updates].map(([employeeId, data]) => prisma.employee.update({ where: { employeeId }, data })),
  ]);

  return NextResponse.json({
    created: results.created,
    updated: results.updated,
    skipped: results.skipped,
    unresolvedDepartments: Array.from(results.unresolvedDepartments),
  });
}
