import type { Role } from "@prisma/client";
import type { SessionPayload } from "./session";

/** Server-side permission checks. Every mutating API route must call the
 * relevant check before touching the database — UI-level hiding is not
 * sufficient on its own. */

export function canManageDevices(role: Role): boolean {
  return role === "IT";
}

export function canManageReferenceLists(role: Role): boolean {
  return role === "IT";
}

/** HR may update only assignedUserId/assignedUserEmail on a Device, plus an
 * Employee's status field. */
export function canEditDeviceAssignmentOnly(role: Role): boolean {
  return role === "HR";
}

export function isReadOnly(role: Role): boolean {
  return role === "FINANCE";
}

export function requireRole(session: SessionPayload | null, roles: Role[]): boolean {
  return !!session && roles.includes(session.role);
}
