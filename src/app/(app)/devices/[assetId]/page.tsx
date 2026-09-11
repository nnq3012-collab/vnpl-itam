import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { classifyAuditEvent, AUDIT_EVENT_BADGE } from "@/lib/audit-log-display";
import MaintenanceForm from "./maintenance-form";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { assetId } = await params;
  const device = await prisma.device.findUnique({
    where: { assetId },
    include: { deviceType: true, location: true, assignedUser: true, vendor: true },
  });
  if (!device) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { assetId: device.assetId },
    orderBy: { timestamp: "desc" },
  });

  const canEdit = session.role === Role.IT || session.role === Role.HR;
  const canLogMaintenance = session.role === Role.IT;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{device.assetId}</h1>
        <div className="flex items-center gap-3">
          {canEdit && (
            <Link
              href={`/devices/update?assetId=${encodeURIComponent(device.assetId)}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Edit
            </Link>
          )}
          <Link href="/devices" className="text-sm text-slate-500 hover:text-slate-800">
            ← Back to Device Master
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <Field label="Device Type" value={device.deviceType.name} />
        <Field label="Make/Model" value={device.makeModel} />
        <Field label="Status" value={device.status} />
        <Field label="CPU" value={device.cpu} />
        <Field label="RAM" value={device.ram} />
        <Field label="Storage" value={device.storage} />
        <Field label="Serial Number" value={device.serialNumber} />
        <Field label="Center" value={device.location.center} />
        <Field label="Department" value={device.location.department} />
        <Field label="Assigned User" value={device.assignedUser?.fullName ?? "Unassigned"} />
        <Field label="Assigned Email" value={device.assignedUserEmail} />
        <Field label="Vendor" value={device.vendor?.name} />
        <Field label="Price" value={device.price != null ? Number(device.price).toLocaleString() : null} />
        <Field label="Purchase Year" value={device.purchaseYear?.toString()} />
        <Field label="Date Registered" value={device.dateRegistered.toLocaleDateString()} />
        <Field label="Last Updated" value={device.lastUpdated.toLocaleDateString()} />
      </div>

      {canLogMaintenance && <MaintenanceForm assetId={device.assetId} />}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="px-4 py-2 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">History</h2>
          <p className="text-xs text-slate-400">
            Allocation, return, lifecycle, hardware, and maintenance events for this device.
          </p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
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
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{log.timestamp.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${AUDIT_EVENT_BADGE[type]}`}>
                      {type === "Other" ? log.action.replace(/_/g, " ") : type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{log.newState ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{log.operator}</td>
                  <td className="px-4 py-2 text-slate-600">{log.reason ?? "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No history recorded for this device yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
