import type { DeviceStatus, EmployeeStatus } from "@prisma/client";

/** Display labels and badge colors for statuses — the one place to change
 * them. Type-only Prisma imports so client components can use this too. */
export const STATUS_LABELS: Record<DeviceStatus, string> = {
  IN_STOCK: "In Stock",
  DEPLOYED: "Deployed",
  IN_REPAIR: "In Repair",
  LOST: "Lost",
  STOLEN: "Stolen",
  BROKEN: "Broken",
  RETIRED: "Retired",
};

export const STATUS_BADGE: Record<DeviceStatus, string> = {
  IN_STOCK: "bg-blue-50 text-blue-700",
  DEPLOYED: "bg-green-50 text-green-700",
  IN_REPAIR: "bg-amber-50 text-amber-700",
  LOST: "bg-red-50 text-red-700",
  STOLEN: "bg-red-50 text-red-700",
  BROKEN: "bg-red-50 text-red-700",
  RETIRED: "bg-slate-100 text-slate-700",
};

/** Device statuses that need a written reason when a device is moved to them. */
export const REASON_REQUIRED_STATUSES: readonly string[] = ["LOST", "STOLEN", "BROKEN", "RETIRED"] satisfies DeviceStatus[];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  RESIGNED: "Resigned",
  TRANSFERRED: "Transferred",
};

/** Label for a status string coming from the client, falling back to the raw value. */
export const statusLabel = (s: string) => STATUS_LABELS[s as DeviceStatus] ?? s;
