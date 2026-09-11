import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeviceStatus } from "@prisma/client";
import SearchBox from "./search-box";

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

async function getStatusCounts() {
  const grouped = await prisma.device.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  const countFor = (statuses: DeviceStatus[]) =>
    grouped
      .filter((g) => statuses.includes(g.status))
      .reduce((sum, g) => sum + g._count.status, 0);

  return {
    inStock: countFor([DeviceStatus.IN_STOCK]),
    deployed: countFor([DeviceStatus.DEPLOYED]),
    inRepair: countFor([DeviceStatus.IN_REPAIR]),
    lostStolenBroken: countFor([DeviceStatus.LOST, DeviceStatus.STOLEN, DeviceStatus.BROKEN]),
    retired: countFor([DeviceStatus.RETIRED]),
  };
}

type StatusCounts = Partial<Record<DeviceStatus, number>>;
type DeptBreakdown = { department: string; total: number; statusCounts: StatusCounts };
type CenterBreakdown = { center: string; total: number; statusCounts: StatusCounts; departments: DeptBreakdown[] };

function addStatus(counts: StatusCounts, status: DeviceStatus) {
  counts[status] = (counts[status] ?? 0) + 1;
}

async function getLocationBreakdown(): Promise<CenterBreakdown[]> {
  const devices = await prisma.device.findMany({
    select: { status: true, location: { select: { center: true, department: true } } },
  });

  const byCenter = new Map<string, { statusCounts: StatusCounts; depts: Map<string, DeptBreakdown> }>();

  for (const d of devices) {
    const { center, department } = d.location;
    if (!byCenter.has(center)) byCenter.set(center, { statusCounts: {}, depts: new Map() });
    const centerEntry = byCenter.get(center)!;
    addStatus(centerEntry.statusCounts, d.status);

    if (!centerEntry.depts.has(department)) {
      centerEntry.depts.set(department, { department, total: 0, statusCounts: {} });
    }
    const deptEntry = centerEntry.depts.get(department)!;
    deptEntry.total += 1;
    addStatus(deptEntry.statusCounts, d.status);
  }

  const result: CenterBreakdown[] = Array.from(byCenter.entries()).map(([center, entry]) => ({
    center,
    total: Object.values(entry.statusCounts).reduce((a, b) => a + b, 0),
    statusCounts: entry.statusCounts,
    departments: Array.from(entry.depts.values()).sort((a, b) => b.total - a.total),
  }));

  return result.sort((a, b) => b.total - a.total);
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

export default async function DashboardPage() {
  const [counts, breakdown] = await Promise.all([getStatusCounts(), getLocationBreakdown()]);
  const grandTotal = breakdown.reduce((sum, c) => sum + c.total, 0);

  const tiles = [
    { label: "In Stock", value: counts.inStock, color: "bg-blue-50 text-blue-700" },
    { label: "Deployed", value: counts.deployed, color: "bg-green-50 text-green-700" },
    { label: "In Repair", value: counts.inRepair, color: "bg-amber-50 text-amber-700" },
    { label: "Lost / Stolen / Broken", value: counts.lostStolenBroken, color: "bg-red-50 text-red-700" },
    { label: "Retired", value: counts.retired, color: "bg-slate-100 text-slate-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 mb-4">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {tiles.map((tile) => (
            <div key={tile.label} className={`rounded-lg p-4 ${tile.color}`}>
              <div className="text-2xl font-semibold">{tile.value}</div>
              <div className="text-xs mt-1">{tile.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-3">Quick search by Asset ID</h2>
        <SearchBox />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-700">Devices by Center &amp; Department</h2>
          <span className="text-xs text-slate-400">{grandTotal} device(s) total</span>
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
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No devices registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm">
        <Link href="/devices" className="text-blue-600 hover:underline">
          View full Device Master list →
        </Link>
      </div>
    </div>
  );
}
