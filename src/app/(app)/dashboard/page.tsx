import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeviceStatus, EmployeeStatus } from "@prisma/client";
import SearchBox from "./search-box";
import { getEmployeesWithoutDevices } from "@/lib/employees-without-devices";
import { EMPLOYEE_STATUS_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/lib/statuses";

type StatusCounts = Partial<Record<DeviceStatus, number>>;
type DeptBreakdown = { department: string; total: number; statusCounts: StatusCounts };
type CenterBreakdown = { center: string; total: number; statusCounts: StatusCounts; departments: DeptBreakdown[] };
type DeviceTypeBreakdown = { deviceTypeId: string; deviceTypeName: string; total: number; statusCounts: StatusCounts };

function addStatus(counts: StatusCounts, status: DeviceStatus, n: number) {
  counts[status] = (counts[status] ?? 0) + n;
}

const sumCounts = (counts: StatusCounts) => Object.values(counts).reduce((a, b) => a + b, 0);

/** Status tiles, Center/Department and Device Type breakdowns from one
 * grouped count, instead of reading every device row. */
async function getBreakdowns() {
  const [grouped, locations, deviceTypes] = await Promise.all([
    prisma.device.groupBy({ by: ["status", "locationId", "deviceTypeId"], _count: { _all: true } }),
    prisma.location.findMany({ select: { id: true, center: true, department: true } }),
    prisma.deviceType.findMany({ select: { id: true, name: true } }),
  ]);
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const typeNameById = new Map(deviceTypes.map((t) => [t.id, t.name]));

  const statusTotals: StatusCounts = {};
  const byCenter = new Map<string, { statusCounts: StatusCounts; depts: Map<string, DeptBreakdown> }>();
  const byType = new Map<string, StatusCounts>();

  for (const g of grouped) {
    const n = g._count._all;
    const { center, department } = locationById.get(g.locationId)!;
    addStatus(statusTotals, g.status, n);

    if (!byCenter.has(center)) byCenter.set(center, { statusCounts: {}, depts: new Map() });
    const centerEntry = byCenter.get(center)!;
    addStatus(centerEntry.statusCounts, g.status, n);
    if (!centerEntry.depts.has(department)) {
      centerEntry.depts.set(department, { department, total: 0, statusCounts: {} });
    }
    const deptEntry = centerEntry.depts.get(department)!;
    deptEntry.total += n;
    addStatus(deptEntry.statusCounts, g.status, n);

    if (!byType.has(g.deviceTypeId)) byType.set(g.deviceTypeId, {});
    addStatus(byType.get(g.deviceTypeId)!, g.status, n);
  }

  const countFor = (statuses: DeviceStatus[]) => statuses.reduce((sum, s) => sum + (statusTotals[s] ?? 0), 0);
  const counts = {
    inStock: countFor([DeviceStatus.IN_STOCK]),
    deployed: countFor([DeviceStatus.DEPLOYED]),
    inRepair: countFor([DeviceStatus.IN_REPAIR]),
    lostStolenBroken: countFor([DeviceStatus.LOST, DeviceStatus.STOLEN, DeviceStatus.BROKEN]),
    retired: countFor([DeviceStatus.RETIRED]),
  };

  const breakdown: CenterBreakdown[] = Array.from(byCenter.entries())
    .map(([center, entry]) => ({
      center,
      total: sumCounts(entry.statusCounts),
      statusCounts: entry.statusCounts,
      departments: Array.from(entry.depts.values()).sort((a, b) => b.total - a.total || a.department.localeCompare(b.department)),
    }))
    .sort((a, b) => b.total - a.total || a.center.localeCompare(b.center));

  const typeBreakdown: DeviceTypeBreakdown[] = Array.from(byType.entries())
    .map(([deviceTypeId, statusCounts]) => ({
      deviceTypeId,
      deviceTypeName: typeNameById.get(deviceTypeId)!,
      total: sumCounts(statusCounts),
      statusCounts,
    }))
    .sort((a, b) => b.total - a.total || a.deviceTypeName.localeCompare(b.deviceTypeName));

  const centers = Array.from(new Set(locations.map((l) => l.center))).sort();
  return { counts, breakdown, typeBreakdown, centers, grandTotal: sumCounts(statusTotals) };
}

async function getStaleAssignments() {
  return prisma.device.findMany({
    where: {
      status: { not: DeviceStatus.RETIRED },
      assignedUserId: { not: null },
      assignedUser: { status: { not: EmployeeStatus.ACTIVE } },
    },
    include: { deviceType: true, location: true, assignedUser: true },
    orderBy: { lastUpdated: "desc" },
  });
}

function StatusChips({ statusCounts }: { statusCounts: StatusCounts }) {
  const entries = (Object.entries(statusCounts) as [DeviceStatus, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {entries.map(([status, count]) => (
        <span key={status} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
          {count} {STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { missingCenter } = await searchParams;
  const selectedCenter = typeof missingCenter === "string" ? missingCenter : "";
  const [{ counts, breakdown, typeBreakdown, centers, grandTotal }, staleAssignments, employeesWithoutDevices] =
    await Promise.all([getBreakdowns(), getStaleAssignments(), getEmployeesWithoutDevices(selectedCenter)]);

  const tiles = [
    { label: STATUS_LABELS.IN_STOCK, value: counts.inStock, color: STATUS_BADGE.IN_STOCK, status: "IN_STOCK" },
    { label: STATUS_LABELS.DEPLOYED, value: counts.deployed, color: STATUS_BADGE.DEPLOYED, status: "DEPLOYED" },
    { label: STATUS_LABELS.IN_REPAIR, value: counts.inRepair, color: STATUS_BADGE.IN_REPAIR, status: "IN_REPAIR" },
    { label: "Lost / Stolen / Broken", value: counts.lostStolenBroken, color: STATUS_BADGE.LOST, status: "LOST,STOLEN,BROKEN" },
    { label: STATUS_LABELS.RETIRED, value: counts.retired, color: STATUS_BADGE.RETIRED, status: "RETIRED" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 mb-4">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              href={`/devices?status=${tile.status}`}
              className={`rounded-lg p-4 ${tile.color} hover:opacity-80 transition-opacity`}
            >
              <div className="text-2xl font-semibold">{tile.value}</div>
              <div className="text-xs mt-1">{tile.label}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-3">Quick search — Asset ID, serial, model, or user name</h2>
        <SearchBox />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-700">Devices by Center &amp; Department</h2>
          <span className="text-xs text-slate-500">{grandTotal} device(s) total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left pb-2">Center</th>
                <th className="text-left pb-2">Department</th>
                <th className="text-right pb-2 w-16">Total</th>
                <th className="text-right pb-2">Status Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {breakdown.map((c) => (
                <Fragment key={c.center}>
                  <tr className="bg-slate-50">
                    <td className="py-1.5 pr-2 font-semibold text-slate-900" colSpan={2}>
                      <Link href={`/devices?center=${encodeURIComponent(c.center)}`} className="hover:underline">
                        {c.center}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right font-semibold text-slate-900">{c.total}</td>
                    <td className="py-1.5">
                      <StatusChips statusCounts={c.statusCounts} />
                    </td>
                  </tr>
                  {c.departments.map((d) => (
                    <tr key={`${c.center}-${d.department}`}>
                      <td className="py-1 pr-2"></td>
                      <td className="py-1 pr-2 text-slate-600">
                        <Link
                          href={`/devices?center=${encodeURIComponent(c.center)}&department=${encodeURIComponent(d.department)}`}
                          className="hover:underline"
                        >
                          {d.department}
                        </Link>
                      </td>
                      <td className="py-1 text-right text-slate-600">{d.total}</td>
                      <td className="py-1">
                        <StatusChips statusCounts={d.statusCounts} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {breakdown.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No devices registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-700">Devices by Type</h2>
          <span className="text-xs text-slate-500">{typeBreakdown.length} type(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left pb-2">Device Type</th>
                <th className="text-right pb-2 w-16">Total</th>
                <th className="text-right pb-2">Status Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {typeBreakdown.map((t) => (
                <tr key={t.deviceTypeId}>
                  <td className="py-1.5 pr-2 text-slate-900">
                    <Link href={`/devices?deviceTypeId=${encodeURIComponent(t.deviceTypeId)}`} className="hover:underline">
                      {t.deviceTypeName}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right text-slate-900">{t.total}</td>
                  <td className="py-1.5">
                    <StatusChips statusCounts={t.statusCounts} />
                  </td>
                </tr>
              ))}
              {typeBreakdown.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">
                    No devices registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-slate-700">Active Devices Linked to Inactive Employees</h2>
          <span className={`text-xs font-medium ${staleAssignments.length > 0 ? "text-amber-700" : "text-slate-500"}`}>
            {staleAssignments.length} device(s)
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Non-retired devices still assigned to an employee marked Resigned or Transferred — reassign or return these.
        </p>
        {staleAssignments.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">All assigned devices belong to active employees.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left pb-2">Asset ID</th>
                  <th className="text-left pb-2">Device Type</th>
                  <th className="text-left pb-2">Status</th>
                  <th className="text-left pb-2">Assigned To</th>
                  <th className="text-left pb-2">Employee Status</th>
                  <th className="text-left pb-2">Center / Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staleAssignments.map((d) => (
                  <tr key={d.id} className="bg-amber-50">
                    <td className="py-1.5 pr-2 font-medium text-slate-900">
                      <Link href={`/devices/${encodeURIComponent(d.assetId)}`} className="hover:underline">
                        {d.assetId}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2 text-slate-600">{d.deviceType.name}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status]}`}>
                        {STATUS_LABELS[d.status]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-slate-600">{d.assignedUser?.fullName ?? "—"}</td>
                    <td className="py-1.5 pr-2">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                        {d.assignedUser ? EMPLOYEE_STATUS_LABELS[d.assignedUser.status] : "—"}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-600">{d.location.center} / {d.location.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-slate-700">Active Employees Without Devices</h2>
          <span className={`text-xs font-medium ${employeesWithoutDevices.length > 0 ? "text-amber-700" : "text-slate-500"}`}>
            {employeesWithoutDevices.length} employee(s)
          </span>
        </div>
        <form method="get" className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs text-slate-500">
            Active employees with no device assigned at all — check whether they are missing from device records.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <select name="missingCenter" defaultValue={selectedCenter} className="rounded-md border border-slate-400 px-2 py-1 text-sm">
              <option value="">All centers</option>
              {centers.map((center) => (
                <option key={center} value={center}>{center}</option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-3 py-1 hover:bg-slate-50">
              Apply
            </button>
            {(["xlsx", "csv"] as const).map((format) => (
              <a
                key={format}
                href={`/api/export/employees-without-devices?format=${format}${selectedCenter ? `&center=${encodeURIComponent(selectedCenter)}` : ""}`}
                className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-3 py-1 hover:bg-slate-50"
              >
                Export .{format}
              </a>
            ))}
          </div>
        </form>
        {employeesWithoutDevices.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Every active employee has at least one device.</p>
        ) : (
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 sticky top-0 bg-white">
                <tr>
                  <th className="text-left pb-2">Employee ID</th>
                  <th className="text-left pb-2">Name</th>
                  <th className="text-left pb-2">Email</th>
                  <th className="text-left pb-2">Center / Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeesWithoutDevices.map((e) => (
                  <tr key={e.id}>
                    <td className="py-1.5 pr-2 font-medium text-slate-900">{e.employeeId}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{e.fullName}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{e.email ?? "—"}</td>
                    <td className="py-1.5 text-slate-600">
                      {e.location ? `${e.location.center} / ${e.location.department}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm">
        <Link href="/devices" className="text-blue-600 hover:underline">
          View full Device Master list →
        </Link>
      </div>
    </div>
  );
}
