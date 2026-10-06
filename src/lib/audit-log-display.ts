export type AuditEventType = "Allocation" | "Return" | "Reassignment" | "Maintenance" | "Deleted" | "Restored" | "Other";

export const MAINTENANCE_CATEGORIES = [
  "Repair",
  "Preventive / Cleaning",
  "Inspection",
  "Part Replacement",
  "Software / OS",
  "Other",
] as const;

/** Maintenance descriptions are stored as "[Category] description" — no
 * schema change, same string-marker approach used for Allocation/Return. */
export function formatMaintenanceDescription(category: string, description: string): string {
  return category ? `[${category}] ${description}` : description;
}

export function parseMaintenanceDescription(newState: string | null): { category: string | null; text: string } {
  if (!newState) return { category: null, text: "" };
  const match = newState.match(/^\[(.+?)\]\s*(.*)$/);
  if (!match) return { category: null, text: newState };
  return { category: match[1], text: match[2] };
}

export function classifyAuditEvent(action: string, newState: string | null): AuditEventType {
  if (action === "MAINTENANCE") return "Maintenance";
  if (action === "DELETION") return "Deleted";
  if (action === "RESTORE") return "Restored";
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
  Deleted: "bg-red-50 text-red-700",
  Restored: "bg-green-50 text-green-700",
  Other: "bg-slate-100 text-slate-700",
};
