import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";
import { prisma } from "@/lib/prisma";
import EmployeesClient from "./client";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canUseFeature(session.role, "reference.employeesAndLocations"))) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">You do not have permission to manage Employees.</p>
      </div>
    );
  }

  const [employees, locations] = await Promise.all([
    prisma.employee.findMany({
      include: { location: true, _count: { select: { devices: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] }),
  ]);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Employees</h1>
      <EmployeesClient
        initial={employees.map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          fullName: e.fullName,
          email: e.email,
          center: e.location?.center ?? null,
          department: e.location?.department ?? null,
          status: e.status,
          deviceCount: e._count.devices,
        }))}
        locations={locations.map((l) => ({ id: l.id, center: l.center, department: l.department }))}
      />
    </div>
  );
}
