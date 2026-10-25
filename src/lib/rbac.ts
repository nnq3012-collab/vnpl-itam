/** Server-side permission checks. Every mutating API route must call the
 * relevant check before touching the database — UI-level hiding is not
 * sufficient on its own. */

/** Deleting a device is restricted to specific named accounts, not the whole
 * IT role — by explicit user request, narrower than every other IT action. */
const DEVICE_DELETE_USERNAMES = ["it_admin"];

export function canDeleteDevices(username: string | undefined): boolean {
  return !!username && DEVICE_DELETE_USERNAMES.includes(username);
}

/** The Configuration tab (assigning which roles can use which feature) is
 * restricted to this specific account, same pattern as device deletion. */
const CONFIG_ADMIN_USERNAMES = ["it_admin"];

export function canConfigureFeatures(username: string | undefined): boolean {
  return !!username && CONFIG_ADMIN_USERNAMES.includes(username);
}
