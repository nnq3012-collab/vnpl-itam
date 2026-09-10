import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageDevices } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import RegisterDeviceForm from "./register-form";

export default async function NewDevicePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageDevices(session.role)) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">
          You do not have permission to register new devices. This action is restricted to IT.
        </p>
      </div>
    );
  }

  const [deviceTypes, locations, employees] = await Promise.all([
    prisma.deviceType.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Register New Device</h1>
      <RegisterDeviceForm
        deviceTypes={deviceTypes.map((t) => ({ id: t.id, name: t.name, hasSpecs: t.hasSpecs }))}
        locations={locations}
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, email: e.email, employeeId: e.employeeId }))}
      />
    </div>
  );
}
