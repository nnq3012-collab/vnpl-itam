/** Request-body parsers shared by device register / update / bulk edit, so
 * blank or invalid values become null the same way everywhere. */
export const textOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
export const priceOrNull = (v: unknown) => (typeof v === "number" && v >= 0 ? v : null);
export const yearOrNull = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);

/** When `after` differs from `before`, sets `update[key]` and records
 * "Label: before → after" for the audit log. */
export function recordChange(
  update: Record<string, unknown>,
  changes: string[],
  key: string,
  label: string,
  before: string | number | null,
  after: string | number | null
) {
  if (after === before) return;
  update[key] = after;
  changes.push(`${label}: ${before ?? "—"} → ${after ?? "—"}`);
}
