import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import UpdateDeviceClient from "./update-client";

export default async function UpdateDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId: initialAssetId } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === Role.FINANCE) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">
          Finance has read-only access and cannot update devices. View details on the Device Master list.
        </p>
      </div>
    );
  }

  const [devices, deviceTypes, locations, employees] = await Promise.all([
    prisma.device.findMany({
      include: { deviceType: true, location: true, assignedUser: true },
      orderBy: { assetId: "asc" },
    }),
    prisma.deviceType.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Update Device</h1>
      <UpdateDeviceClient
        role={session.role}
        initialAssetId={initialAssetId}
        devices={devices.map((d) => ({
          id: d.id,
          assetId: d.assetId,
          deviceTypeId: d.deviceTypeId,
          deviceTypeName: d.deviceType.name,
          makeModel: d.makeModel,
          cpu: d.cpu,
          ram: d.ram,
          storage: d.storage,
          serialNumber: d.serialNumber,
          status: d.status,
          center: d.location.center,
          department: d.location.department,
          assignedUserId: d.assignedUserId,
          assignedUserName: d.assignedUser?.fullName ?? null,
          assignedUserEmail: d.assignedUserEmail,
          assignedUserStatus: d.assignedUser?.status ?? null,
        }))}
        deviceTypes={deviceTypes.map((t) => ({ id: t.id, name: t.name, hasSpecs: t.hasSpecs }))}
        locations={locations.map((l) => ({ id: l.id, center: l.center, department: l.department }))}
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, email: e.email, employeeId: e.employeeId, status: e.status }))}
      />
    </div>
  );
}
