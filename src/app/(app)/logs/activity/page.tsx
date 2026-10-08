import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canConfigureFeatures, canDeleteDevices } from "@/lib/rbac";
import { AuditAction, Prisma } from "@prisma/client";
import { classifyAuditEvent, AUDIT_EVENT_BADGE } from "@/lib/audit-log-display";
import ReorderableTable, { type TableColumn, type TableRow } from "@/components/reorderable-table";
import MultiFilter from "../../devices/multi-filter";
import RestoreButton from "./restore-button";

const ACTION_LABELS: Record<AuditAction, string> = {
  INITIAL_REGISTRATION: "Registered",
  BULK_IMPORT: "Imported",
  LIFECYCLE_UPDATE: "Lifecycle update",
  REASSIGNMENT: "Reassignment",
  HARDWARE_CHANGE: "Hardware change",
  MAINTENANCE: "Maintenance",
  BATCH: "Batch",
  DELETION: "Deleted",
  RESTORE: "Restored",
};

const all = (v: string | string[] | undefined) => [v ?? []].flat().filter(Boolean);
const first = (v: string | string[] | undefined) => all(v)[0] ?? "";

// Date filters are read as Vietnam local days (UTC+7), where the team works.
const dayStart = (d: string) => new Date(`${d}T00:00:00+07:00`);

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Admin-only: restricted to the same account(s) as the Configuration tab.
  if (!canConfigureFeatures(session.username)) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">The Activity Log is restricted to the IT Admin account.</p>
      </div>
    );
  }
  const canRestore = canDeleteDevices(session.username);

  const params = await searchParams;
  const assetId = first(params.assetId);
  const operator = first(params.operator);
  const from = first(params.from);
  const to = first(params.to);
  const actions = all(params.action).filter((a): a is AuditAction => a in AuditAction);

  const where: Prisma.AuditLogWhereInput = {
    ...(assetId ? { assetId: { contains: assetId, mode: "insensitive" } } : {}),
    ...(operator ? { operator } : {}),
    ...(actions.length ? { action: { in: actions } } : {}),
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { gte: dayStart(from) } : {}),
            ...(to ? { lt: new Date(dayStart(to).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };

  const [logs, operators] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { timestamp: "desc" }, take: 500 }),
    prisma.auditLog.findMany({ distinct: ["operator"], select: { operator: true }, orderBy: { operator: "asc" } }),
  ]);

  // Restore is offered only while the Asset ID is free again.
  const deletedAssetIds = logs.filter((l) => l.action === AuditAction.DELETION).map((l) => l.assetId);
  const existing = new Set(
    (await prisma.device.findMany({ where: { assetId: { in: deletedAssetIds } }, select: { assetId: true } })).map((d) => d.assetId)
  );

  const columns: TableColumn[] = [
    { key: "date", header: "Date" },
    { key: "assetId", header: "Asset ID" },
    { key: "type", header: "Type" },
    { key: "before", header: "Before" },
    { key: "details", header: "Details" },
    { key: "operator", header: "Operator" },
    { key: "reason", header: "Reason" },
    { key: "actions", header: "" },
  ];

  const rows: TableRow[] = logs.map((log) => {
    const type = classifyAuditEvent(log.action, log.newState);
    const deviceGone = log.action === AuditAction.DELETION && !existing.has(log.assetId);
    return {
      key: log.id,
      cells: {
        date: <span className="text-slate-600 whitespace-nowrap">{log.timestamp.toLocaleString()}</span>,
        assetId: deviceGone ? (
          <span className="font-medium text-slate-900">{log.assetId}</span>
        ) : (
          <Link href={`/devices/${encodeURIComponent(log.assetId)}`} className="font-medium text-blue-600 hover:underline">
            {log.assetId}
          </Link>
        ),
        type: (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${AUDIT_EVENT_BADGE[type]}`}>
            {type === "Other" ? ACTION_LABELS[log.action] : type}
          </span>
        ),
        before: <span className="text-slate-600">{log.previousState ?? "—"}</span>,
        details: <span className="text-slate-600">{log.newState ?? "—"}</span>,
        operator: <span className="text-slate-600">{log.operator}</span>,
        reason: <span className="text-slate-600">{log.reason ?? "—"}</span>,
        actions:
          canRestore && deviceGone && log.snapshot ? <RestoreButton logId={log.id} assetId={log.assetId} /> : null,
      },
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Activity Log</h1>

      <form className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end" method="get">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Asset ID</label>
          <input
            type="text"
            name="assetId"
            defaultValue={assetId}
            className="rounded-md border border-slate-400 px-2 py-1.5 text-sm"
            placeholder="Search..."
          />
        </div>
        <MultiFilter
          label="Type"
          name="action"
          options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
          selected={actions}
        />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Operator</label>
          <select name="operator" defaultValue={operator} className="rounded-md border border-slate-400 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {operators.map(({ operator: o }) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input type="date" name="from" defaultValue={from} className="rounded-md border border-slate-400 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input type="date" name="to" defaultValue={to} className="rounded-md border border-slate-400 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
          Filter
        </button>
        <Link href="/logs/activity" className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-4 py-1.5 hover:bg-slate-50">
          Reset
        </Link>
      </form>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <ReorderableTable
          storageKey="activity-log-column-order"
          columns={columns}
          rows={rows}
          emptyMessage="No activity matches the current filters."
        />
      </div>
      <p className="text-xs text-slate-600">
        {logs.length} event(s) shown (most recent 500 matching).
        {canRestore && " Deleted devices recorded from now on can be restored with the Restore button."}
      </p>
    </div>
  );
}
