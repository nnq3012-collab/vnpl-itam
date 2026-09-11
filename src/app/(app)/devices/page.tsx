import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeviceStatus, Prisma, Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { canDeleteDevices } from "@/lib/rbac";
import SelectAllCheckbox from "./select-all";
import BulkDeleteButton from "./bulk-delete-button";

const STATUS_LABELS: Record<DeviceStatus, string> = {
  IN_STOCK: "In Stock",
  DEPLOYED: "Deployed",
  IN_REPAIR: "In Repair",
  LOST: "Lost",
  STOLEN: "Stolen",
  BROKEN: "Broken",
  RETIRED: "Retired",
};

const STATUS_BADGE: Record<DeviceStatus, string> = {
  IN_STOCK: "bg-blue-50 text-blue-700",
  DEPLOYED: "bg-green-50 text-green-700",
  IN_REPAIR: "bg-amber-50 text-amber-700",
  LOST: "bg-red-50 text-red-700",
  STOLEN: "bg-red-50 text-red-700",
  BROKEN: "bg-red-50 text-red-700",
  RETIRED: "bg-slate-100 text-slate-700",
};

type SearchParams = {
  assetId?: string;
  status?: string;
  center?: string;
  department?: string;
  deviceTypeId?: string;
  assignedUserId?: string;
  sort?: string;
  dir?: string;
};

function buildOrderBy(sort?: string, dir?: string): Prisma.DeviceOrderByWithRelationInput {
  const direction: Prisma.SortOrder = dir === "desc" ? "desc" : "asc";
  switch (sort) {
    case "assetId":
      return { assetId: direction };
    case "deviceType":
      return { deviceType: { name: direction } };
    case "status":
      return { status: direction };
    case "center":
      return { location: { center: direction } };
    case "assignedUser":
      return { assignedUser: { fullName: direction } };
    case "lastUpdated":
      return { lastUpdated: direction };
    default:
      return { assetId: "asc" };
  }
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const canEdit = session?.role === Role.IT || session?.role === Role.HR;
  const canDelete = canDeleteDevices(session?.username);

  const where: Prisma.DeviceWhereInput = {};
  if (params.assetId) where.assetId = { contains: params.assetId };
  if (params.status) where.status = params.status as DeviceStatus;
  if (params.deviceTypeId) where.deviceTypeId = params.deviceTypeId;
  if (params.assignedUserId) {
    where.assignedUserId = params.assignedUserId === "UNASSIGNED" ? null : params.assignedUserId;
  }
  if (params.center || params.department) {
    where.location = {
      ...(params.center ? { center: params.center } : {}),
      ...(params.department ? { department: params.department } : {}),
    };
  }

  const [devices, deviceTypes, locations, employees] = await Promise.all([
    prisma.device.findMany({
      where,
      include: { deviceType: true, location: true, assignedUser: true },
      orderBy: buildOrderBy(params.sort, params.dir),
    }),
    prisma.deviceType.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  const centers = Array.from(new Set(locations.map((l) => l.center))).sort();
  const departments = Array.from(new Set(locations.map((l) => l.department))).sort();

  function sortLink(field: string, label: string) {
    const nextDir = params.sort === field && params.dir !== "desc" ? "desc" : "asc";
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && k !== "sort" && k !== "dir") qs.set(k, v);
    });
    qs.set("sort", field);
    qs.set("dir", nextDir);
    const active = params.sort === field;
    return (
      <a href={`/devices?${qs.toString()}`} className="inline-flex items-center gap-1 hover:underline">
        {label}
        {active && <span className="text-xs">{params.dir === "desc" ? "▼" : "▲"}</span>}
      </a>
    );
  }

  const exportParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && k !== "sort" && k !== "dir") exportParams.set(k, v);
  });
  const exportQuery = exportParams.toString();

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-slate-50 pb-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Device Master</h1>
          <div className="flex gap-2">
            <a
              href={`/api/export/devices?${exportQuery}${exportQuery ? "&" : ""}format=xlsx`}
              className="rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-900 px-3 py-1.5 hover:bg-slate-50"
            >
              Export .xlsx
            </a>
            <a
              href={`/api/export/devices?${exportQuery}${exportQuery ? "&" : ""}format=csv`}
              className="rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-900 px-3 py-1.5 hover:bg-slate-50"
            >
              Export .csv
            </a>
          </div>
        </div>

        <form className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end" method="get">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Asset ID</label>
          <input
            type="text"
            name="assetId"
            defaultValue={params.assetId ?? ""}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Search..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Center</label>
          <select name="center" defaultValue={params.center ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {centers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
          <select name="department" defaultValue={params.department ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Device Type</label>
          <select name="deviceTypeId" defaultValue={params.deviceTypeId ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {deviceTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Assigned User</label>
          <select name="assignedUserId" defaultValue={params.assignedUserId ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="UNASSIGNED">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
            Filter
          </button>
          <a href="/devices" className="rounded-md border border-slate-300 text-sm font-medium px-4 py-1.5 hover:bg-slate-50">
            Reset
          </a>
          <button
            type="submit"
            form="print-labels-form"
            className="rounded-md bg-slate-800 text-white text-sm font-medium px-4 py-1.5 hover:bg-slate-900"
          >
            Print Labels
          </button>
          {canDelete && <BulkDeleteButton />}
        </div>
        </form>
      </div>

      <form id="print-labels-form" method="get" action="/labels" target="_blank" className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="flex items-center px-4 py-2 border-b border-slate-100">
          <span className="text-xs text-slate-400">Check devices below, then click &quot;Print Labels&quot; above.</span>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left"><SelectAllCheckbox /></th>
              <th className="px-4 py-2 text-left">{sortLink("assetId", "Asset ID")}</th>
              <th className="px-4 py-2 text-left">{sortLink("deviceType", "Device Type")}</th>
              <th className="px-4 py-2 text-left">Make/Model</th>
              <th className="px-4 py-2 text-left">CPU</th>
              <th className="px-4 py-2 text-left">RAM</th>
              <th className="px-4 py-2 text-left">Storage</th>
              <th className="px-4 py-2 text-left">Serial Number</th>
              <th className="px-4 py-2 text-left">{sortLink("status", "Status")}</th>
              <th className="px-4 py-2 text-left">{sortLink("center", "Center")}</th>
              <th className="px-4 py-2 text-left">Department</th>
              <th className="px-4 py-2 text-left">{sortLink("assignedUser", "Assigned User")}</th>
              <th className="px-4 py-2 text-left">Assigned Email</th>
              <th className="px-4 py-2 text-left">Date Registered</th>
              <th className="px-4 py-2 text-left">{sortLink("lastUpdated", "Last Updated")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <input type="checkbox" name="assetId" value={d.assetId} className="h-4 w-4 rounded border-slate-300" />
                </td>
                <td className="px-4 py-2 font-medium text-slate-900">
                  {canEdit ? (
                    <Link href={`/devices/update?assetId=${encodeURIComponent(d.assetId)}`} className="text-blue-600 hover:underline">
                      {d.assetId}
                    </Link>
                  ) : (
                    d.assetId
                  )}
                </td>
                <td className="px-4 py-2 text-slate-900">{d.deviceType.name}</td>
                <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{d.makeModel ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{d.cpu ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{d.ram ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{d.storage ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{d.serialNumber ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status]}`}>
                    {STATUS_LABELS[d.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{d.location.center}</td>
                <td className="px-4 py-2 text-slate-600">{d.location.department}</td>
                <td className="px-4 py-2 text-slate-600">{d.assignedUser?.fullName ?? "Unassigned"}</td>
                <td className="px-4 py-2 text-slate-600">{d.assignedUserEmail ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{d.dateRegistered.toLocaleDateString()}</td>
                <td className="px-4 py-2 text-slate-500">{d.lastUpdated.toLocaleDateString()}</td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-slate-400">
                  No devices match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </form>
      <p className="text-xs text-slate-400">{devices.length} device(s) shown.</p>
    </div>
  );
}
