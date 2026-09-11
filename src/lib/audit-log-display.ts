export type AuditEventType = "Allocation" | "Return" | "Reassignment" | "Maintenance" | "Other";

export function classifyAuditEvent(action: string, newState: string | null): AuditEventType {
  if (action === "MAINTENANCE") return "Maintenance";
  if (!newState) return "Other";
  if (newState.includes("Allocation:")) return "Allocation";
  if (newState.includes("Return:")) return "Return";
  if (newState.includes("Reassignment:")) return "Reassignment";
  return "Other";
}

export const AUDIT_EVENT_BADGE: Record<AuditEventType, string> = {
  Allocation: "bg-green-50 text-green-700",
  Return: "bg-amber-50 text-amber-700",
  Reassignment: "bg-blue-50 text-blue-700",
  Maintenance: "bg-purple-50 text-purple-700",
  Other: "bg-slate-100 text-slate-700",
};
