import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeviceStatus, Prisma, Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { canDeleteDevices } from "@/lib/rbac";
import { canUseFeature } from "@/lib/feature-access";
import SelectAllCheckbox from "./select-all";
import BulkDeleteButton from "./bulk-delete-button";
import BulkEditPanel from "./bulk-edit-panel";
import ReorderableTable, { type TableColumn, type TableRow } from "@/components/reorderable-table";

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
  highlight?: string;
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
  const canBulkEdit = session ? await canUseFeature(session.role, "devices.bulkEdit") : false;

  const where: Prisma.DeviceWhereInput = {};
  if (params.assetId) where.assetId = { contains: params.assetId };
  if (params.status) {
    const statuses = params.status.split(",") as DeviceStatus[];
    where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
  }
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

  const [devices, deviceTypes, locations, employees, vendors] = await Promise.all([
    prisma.device.findMany({
      where,
      include: { deviceType: true, location: true, assignedUser: true, vendor: true },
      orderBy: buildOrderBy(params.sort, params.dir),
    }),
    prisma.deviceType.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  const centers = Array.from(new Set(locations.map((l) => l.center))).sort();
  const departments = Array.from(new Set(locations.map((l) => l.department))).sort();

  const currentYear = new Date().getFullYear();
  function depreciationInfo(d: (typeof devices)[number]) {
    const months = d.deviceType.depreciationMonths;
    const price = d.price != null ? Number(d.price) : null;
    if (months == null || price == null || d.purchaseYear == null) return null;
    const monthsElapsed = Math.max(0, (currentYear - d.purchaseYear) * 12);
    const fullyDepreciated = monthsElapsed >= months;
    const remainingValue = fullyDepreciated ? 0 : price * (1 - monthsElapsed / months);
    return { remainingValue, fullyDepreciated };
  }

  const creationLogs = await prisma.auditLog.findMany({
    where: { assetId: { in: devices.map((d) => d.assetId) } },
    orderBy: { timestamp: "asc" },
    select: { assetId: true, operator: true },
  });
  const createdByAssetId = new Map<string, string>();
  for (const log of creationLogs) {
    if (!createdByAssetId.has(log.assetId)) createdByAssetId.set(log.assetId, log.operator);
  }

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

  const pinnedColumn: TableColumn = { key: "select", header: <SelectAllCheckbox /> };

  const columns: TableColumn[] = [
    { key: "assetId", header: sortLink("assetId", "Asset ID") },
    { key: "deviceType", header: sortLink("deviceType", "Device Type") },
    { key: "makeModel", header: "Make/Model" },
    { key: "cpu", header: "CPU" },
    { key: "ram", header: "RAM" },
    { key: "storage", header: "Storage" },
    { key: "serialNumber", header: "Serial Number" },
    { key: "status", header: sortLink("status", "Status") },
    { key: "center", header: sortLink("center", "Center") },
    { key: "department", header: "Department" },
    { key: "assignedUser", header: sortLink("assignedUser", "Assigned User") },
    { key: "assignedEmail", header: "Assigned Email" },
    { key: "vendor", header: "Vendor" },
    { key: "price", header: "Price" },
    { key: "purchaseYear", header: "Purchase Year" },
    { key: "remainingValue", header: "Remaining Value" },
    { key: "dateRegistered", header: "Date Registered" },
    { key: "lastUpdated", header: sortLink("lastUpdated", "Last Updated") },
    { key: "createdBy", header: "Created By" },
  ];

  const rows: TableRow[] = devices.map((d) => {
    const depreciation = depreciationInfo(d);
    return {
      key: d.assetId,
      rowClassName: params.highlight === d.assetId ? "bg-amber-50" : "",
      cells: {
        select: <input type="checkbox" name="assetId" value={d.assetId} className="h-4 w-4 rounded border-slate-300" />,
        assetId: (
          <span className="font-medium text-slate-900">
            <Link href={`/devices/${encodeURIComponent(d.assetId)}`} className="text-blue-600 hover:underline">
              {d.assetId}
            </Link>
            {canEdit && (
              <Link
                href={`/devices/update?assetId=${encodeURIComponent(d.assetId)}`}
                className="ml-2 text-xs text-slate-400 hover:text-slate-700"
              >
                Edit
              </Link>
            )}
          </span>
        ),
        deviceType: <span className="text-slate-900">{d.deviceType.name}</span>,
        makeModel: <span className="text-slate-600 max-w-xs truncate block">{d.makeModel ?? "—"}</span>,
        cpu: <span className="text-slate-600">{d.cpu ?? "—"}</span>,
        ram: <span className="text-slate-600">{d.ram ?? "—"}</span>,
        storage: <span className="text-slate-600">{d.storage ?? "—"}</span>,
        serialNumber: <span className="text-slate-600">{d.serialNumber ?? "—"}</span>,
        status: (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status]}`}>
            {STATUS_LABELS[d.status]}
          </span>
        ),
        center: <span className="text-slate-600">{d.location.center}</span>,
        department: <span className="text-slate-600">{d.location.department}</span>,
        assignedUser: <span className="text-slate-600">{d.assignedUser?.fullName ?? "Unassigned"}</span>,
        assignedEmail: <span className="text-slate-600">{d.assignedUserEmail ?? "—"}</span>,
        vendor: <span className="text-slate-600">{d.vendor?.name ?? "—"}</span>,
        price: <span className="text-slate-600">{d.price != null ? Number(d.price).toLocaleString() : "—"}</span>,
        purchaseYear: <span className="text-slate-600">{d.purchaseYear ?? "—"}</span>,
        remainingValue: depreciation ? (
          depreciation.fullyDepreciated ? (
            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">
              Fully depreciated
            </span>
          ) : (
            <span className="text-slate-600">{depreciation.remainingValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          )
        ) : (
          <span className="text-slate-400">—</span>
        ),
        dateRegistered: <span className="text-slate-500">{d.dateRegistered.toLocaleDateString()}</span>,
        lastUpdated: <span className="text-slate-500">{d.lastUpdated.toLocaleDateString()}</span>,
        createdBy: <span className="text-slate-600">{createdByAssetId.get(d.assetId) ?? "—"}</span>,
      },
    };
  });

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
          {canBulkEdit && <BulkEditPanel vendors={vendors} locations={locations} />}
          {canDelete && <BulkDeleteButton />}
        </div>
        </form>
      </div>

      <form id="print-labels-form" method="get" action="/labels" target="_blank" className="bg-white rounded-lg shadow overflow-x-auto">
        <ReorderableTable
          storageKey="device-master-column-order"
          pinnedColumn={pinnedColumn}
          columns={columns}
          rows={rows}
          emptyMessage="No devices match the current filters."
          hint='Check devices below, then click "Print Labels" above.'
        />
      </form>
      <p className="text-xs text-slate-400">{devices.length} device(s) shown.</p>
    </div>
  );
}
