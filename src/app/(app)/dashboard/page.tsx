import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeviceStatus } from "@prisma/client";
import SearchBox from "./search-box";

async function getCounts() {
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

export default async function DashboardPage() {
  const counts = await getCounts();

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

      <div className="text-sm">
        <Link href="/devices" className="text-blue-600 hover:underline">
          View full Device Master list →
        </Link>
      </div>
    </div>
  );
}
