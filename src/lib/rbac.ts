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

/** Deleting a device is restricted to specific named accounts, not the whole
 * IT role — by explicit user request, narrower than every other IT action. */
const DEVICE_DELETE_USERNAMES = ["it_admin"];

export function canDeleteDevices(username: string | undefined): boolean {
  return !!username && DEVICE_DELETE_USERNAMES.includes(username);
}
