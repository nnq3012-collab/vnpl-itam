import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { classifyAuditEvent, AUDIT_EVENT_BADGE } from "@/lib/audit-log-display";

const ALLOCATION_MARKERS = ["Allocation:", "Return:", "Reassignment:"];

export default async function AllocationLogPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { assetId } = await searchParams;

  const where: Prisma.AuditLogWhereInput = {
    OR: ALLOCATION_MARKERS.map((marker) => ({ newState: { contains: marker } })),
    ...(assetId ? { assetId: { contains: assetId } } : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Allocation &amp; Return Log</h1>

      <form className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end" method="get">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Asset ID</label>
          <input
            type="text"
            name="assetId"
            defaultValue={assetId ?? ""}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Search..."
          />
        </div>
        <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
          Filter
        </button>
        <a href="/logs/allocation" className="rounded-md border border-slate-300 text-sm font-medium px-4 py-1.5 hover:bg-slate-50">
          Reset
        </a>
      </form>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Asset ID</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Details</th>
              <th className="px-4 py-2 text-left">Operator</th>
              <th className="px-4 py-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => {
              const type = classifyAuditEvent(log.action, log.newState);
              return (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{log.timestamp.toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{log.assetId}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${AUDIT_EVENT_BADGE[type]}`}>
                      {type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{log.newState}</td>
                  <td className="px-4 py-2 text-slate-600">{log.operator}</td>
                  <td className="px-4 py-2 text-slate-600">{log.reason ?? "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No allocation or return events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{logs.length} event(s) shown (most recent 500).</p>
    </div>
  );
}
