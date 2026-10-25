import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUseFeature } from "@/lib/feature-access";
import { AssetPicker, EditForm } from "./update-client";

export default async function UpdateDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId: initialAssetId } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const [canEditAll, canAssign, canLogMaintenance] = await Promise.all([
    canUseFeature(session.role, "devices.edit"),
    canUseFeature(session.role, "devices.assign"),
    canUseFeature(session.role, "devices.maintenance"),
  ]);
  if (!canEditAll && !canAssign) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">
          Your role cannot update devices. View details on the Device Master list, or ask an admin to grant access via Configuration.
        </p>
      </div>
    );
  }

  const heading = <h1 className="text-lg font-semibold text-slate-900 mb-4">Update Device</h1>;

  // The full record and form lists are loaded only once a device is picked;
  // the picker itself needs just Asset ID, type and status.
  const d = initialAssetId
    ? await prisma.device.findUnique({
        where: { assetId: initialAssetId },
        include: { deviceType: true, location: true, assignedUser: true, batches: { select: { name: true } } },
      })
    : null;

  if (!d) {
    const assets = await prisma.device.findMany({
      select: { id: true, assetId: true, status: true, deviceType: { select: { name: true } } },
      orderBy: { assetId: "asc" },
    });
    return (
      <div className="max-w-2xl">
        {heading}
        <AssetPicker assets={assets.map((a) => ({ id: a.id, assetId: a.assetId, deviceTypeName: a.deviceType.name, status: a.status }))} />
      </div>
    );
  }

  const [deviceTypes, locations, employees, vendors, batches, canManageBatches] = await Promise.all([
    prisma.deviceType.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.batch.findMany({ orderBy: { createdAt: "desc" }, select: { name: true } }),
    canUseFeature(session.role, "devices.bulkEdit"),
  ]);

  return (
    <div className="max-w-2xl">
      {heading}
      <EditForm
        key={d.id}
        canEditAll={canEditAll}
        canAssign={canAssign}
        canLogMaintenance={canLogMaintenance}
        device={{
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
          vendorId: d.vendorId,
          price: d.price != null ? Number(d.price) : null,
          purchaseYear: d.purchaseYear,
          batches: d.batches.map((b) => b.name),
        }}
        allBatches={canManageBatches ? batches.map((b) => b.name) : null}
        deviceTypes={deviceTypes.map((t) => ({ id: t.id, name: t.name, hasSpecs: t.hasSpecs }))}
        locations={locations.map((l) => ({ id: l.id, center: l.center, department: l.department }))}
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, email: e.email, employeeId: e.employeeId, status: e.status }))}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
      />
    </div>
  );
}
