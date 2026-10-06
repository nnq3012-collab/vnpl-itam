"use client";

import { useMemo, useState } from "react";
import MultiFilter from "../../devices/multi-filter";

type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  email: string | null;
  center: string | null;
  department: string | null;
  status: string;
  deviceCount: number;
};
type Location = { id: string; center: string; department: string };

const STATUS_OPTIONS = ["ACTIVE", "RESIGNED", "TRANSFERRED"];
const DETAILS_OPTIONS = [
  { value: "missing", label: "Missing Center/Department" },
  { value: "complete", label: "Complete" },
];
const DEVICE_OPTIONS = [
  { value: "has", label: "Has devices" },
  { value: "none", label: "No devices" },
];

const emptyForm = { employeeId: "", fullName: "", email: "", center: "", department: "", status: "ACTIVE" };

// These placeholder rows never had a real department in the source data —
// don't flag them as "needs review" alongside genuine gaps.
const PLACEHOLDER_EMPLOYEE_IDS = new Set(["000000", "000001"]);

function needsReview(item: Employee) {
  return !item.center && !PLACEHOLDER_EMPLOYEE_IDS.has(item.employeeId);
}

export default function EmployeesClient({ initial, locations }: { initial: Employee[]; locations: Location[] }) {
  const [items, setItems] = useState(initial);
  const [newForm, setNewForm] = useState(emptyForm);
  // Rows currently in edit mode, keyed by employee id — several at once for
  // "Edit selected rows".
  const [edits, setEdits] = useState<Record<string, typeof emptyForm>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    status: [] as string[],
    center: [] as string[],
    department: [] as string[],
    devices: [] as string[],
    details: [] as string[],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ useStatus: false, status: "RESIGNED", useLocation: false, center: "", department: "" });

  const centers = useMemo(() => Array.from(new Set(locations.map((l) => l.center))).sort(), [locations]);
  const allDepartments = useMemo(() => Array.from(new Set(locations.map((l) => l.department))).sort(), [locations]);
  const departmentsFor = (center: string) =>
    locations.filter((l) => l.center === center).map((l) => l.department).sort();

  function sortItems(list: Employee[]) {
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  function toEmployee(
    raw: { id: string; employeeId: string; fullName: string; email: string | null; status: string; location?: { center: string; department: string } | null },
    deviceCount = 0
  ): Employee {
    return {
      id: raw.id,
      employeeId: raw.employeeId,
      fullName: raw.fullName,
      email: raw.email,
      center: raw.location?.center ?? null,
      department: raw.location?.department ?? null,
      status: raw.status,
      deviceCount,
    };
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/reference/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => sortItems([...prev, toEmployee(data.employee)]));
    setNewForm(emptyForm);
  }

  function startEdit(list: Employee[]) {
    setEdits((prev) => {
      const next = { ...prev };
      for (const item of list) {
        next[item.id] ??= {
          employeeId: item.employeeId,
          fullName: item.fullName,
          email: item.email ?? "",
          center: item.center ?? "",
          department: item.department ?? "",
          status: item.status,
        };
      }
      return next;
    });
  }

  function setEditField(id: string, patch: Partial<typeof emptyForm>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function cancelEdit(id: string) {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /** Saves one row; returns an error message, or null on success. */
  async function saveRow(item: Employee): Promise<string | null> {
    const res = await fetch(`/api/reference/employees/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits[item.id]),
    });
    const data = await res.json();
    if (!res.ok) return `${item.fullName}: ${data.error}`;
    setItems((prev) => sortItems(prev.map((i) => (i.id === item.id ? toEmployee(data.employee, i.deviceCount) : i))));
    cancelEdit(item.id);
    return null;
  }

  async function saveEdit(item: Employee) {
    setError(await saveRow(item));
  }

  // Saves every row in edit mode; rows that fail stay open with the reason shown.
  async function saveAllEdits() {
    const rows = items.filter((i) => edits[i.id]);
    const errors: string[] = [];
    for (const item of rows) {
      const err = await saveRow(item);
      if (err) errors.push(err);
    }
    setError(errors.length ? `Saved ${rows.length - errors.length} of ${rows.length}. ${errors.join(" · ")}` : null);
  }

  async function handleDelete(item: Employee) {
    if (!confirm(`Delete "${item.fullName}"? This only works if they have no devices assigned.`)) return;
    setError(null);
    const res = await fetch(`/api/reference/employees/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  function toggleSelected(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function applyBulk() {
    setError(null);
    if (!bulk.useStatus && !bulk.useLocation) return setError("Turn on Status and/or Location to bulk edit.");
    if (bulk.useLocation && (!bulk.center || !bulk.department)) return setError("Pick both Center and Department.");
    if (!confirm(`Apply these changes to ${selected.size} employee(s)?`)) return;
    const res = await fetch("/api/reference/employees/bulk-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: Array.from(selected),
        ...(bulk.useStatus ? { status: bulk.status } : {}),
        ...(bulk.useLocation ? { center: bulk.center, department: bulk.department } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    const updated = new Map<string, Parameters<typeof toEmployee>[0]>(
      data.employees.map((e: Parameters<typeof toEmployee>[0]) => [e.id, e])
    );
    setItems((prev) => prev.map((i) => (updated.has(i.id) ? toEmployee(updated.get(i.id)!, i.deviceCount) : i)));
    setSelected(new Set());
  }

  const filtered = items
    .filter((i) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        i.fullName.toLowerCase().includes(q) ||
        i.employeeId.toLowerCase().includes(q) ||
        (i.email ?? "").toLowerCase().includes(q)
      );
    })
    .filter((i) => filters.details.length === 0 || filters.details.includes(needsReview(i) ? "missing" : "complete"))
    .filter((i) => filters.status.length === 0 || filters.status.includes(i.status))
    .filter((i) => filters.center.length === 0 || filters.center.includes(i.center ?? ""))
    .filter((i) => filters.department.length === 0 || filters.department.includes(i.department ?? ""))
    .filter((i) => filters.devices.length === 0 || filters.devices.includes(i.deviceCount > 0 ? "has" : "none"));

  const reviewCount = items.filter(needsReview).length;
  const editCount = Object.keys(edits).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      {reviewCount > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            <span className="font-medium">{reviewCount} employee(s)</span> marked <span className="font-semibold">*</span> are
            missing or have unclear Center/Department — please assign these manually below.
          </p>
          <span className="text-xs text-amber-800 whitespace-nowrap ml-4">Use the Details filter below to list them.</span>
        </div>
      )}

      {/* Collapsed, blue-tinted panel so it can't be mistaken for the search/filter bar below. */}
      <details className="group rounded-lg border border-blue-200 bg-blue-50 shadow">
        <summary className="list-none cursor-pointer select-none px-4 py-3 text-sm font-medium text-blue-800 flex items-center gap-2">
          <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
          Add New Employee
        </summary>
      <form onSubmit={handleAdd} className="px-4 pb-4">
        <div className="grid grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Employee ID</label>
            <input value={newForm.employeeId} onChange={(e) => setNewForm({ ...newForm, employeeId: e.target.value })}
              className="w-full rounded-md border border-slate-400 px-2 py-1.5 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
            <input value={newForm.fullName} onChange={(e) => setNewForm({ ...newForm, fullName: e.target.value })}
              className="w-full rounded-md border border-slate-400 px-2 py-1.5 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              className="w-full rounded-md border border-slate-400 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Center</label>
            <select value={newForm.center}
              onChange={(e) => setNewForm({ ...newForm, center: e.target.value, department: "" })}
              className="w-full rounded-md border border-slate-400 px-2 py-1.5 text-sm">
              <option value="">—</option>
              {centers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
            <select value={newForm.department}
              onChange={(e) => setNewForm({ ...newForm, department: e.target.value })}
              disabled={!newForm.center}
              className="w-full rounded-md border border-slate-400 px-2 py-1.5 text-sm disabled:bg-slate-50">
              <option value="">—</option>
              {departmentsFor(newForm.center).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
              Add
            </button>
          </div>
        </div>
      </form>
      </details>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Search &amp; Filter Employees</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="block text-xs font-medium text-slate-600 mb-1">Search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, employee ID, or email..."
            className="w-64 rounded-md border border-slate-400 px-3 py-1.5 text-sm"
          />
        </div>
        <MultiFilter label="Status" name="status" options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          selected={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
        <MultiFilter label="Center" name="center" options={centers.map((c) => ({ value: c, label: c }))}
          selected={filters.center} onChange={(v) => setFilters({ ...filters, center: v })} />
        <MultiFilter label="Department" name="department" options={allDepartments.map((d) => ({ value: d, label: d }))}
          selected={filters.department} onChange={(v) => setFilters({ ...filters, department: v })} />
        <MultiFilter label="Devices" name="devices" options={DEVICE_OPTIONS}
          selected={filters.devices} onChange={(v) => setFilters({ ...filters, devices: v })} />
        <MultiFilter label="Details" name="details" options={DETAILS_OPTIONS}
          selected={filters.details} onChange={(v) => setFilters({ ...filters, details: v })} />
        <span className="text-xs text-slate-600 pb-2">{filtered.length} of {items.length} shown</span>
      </div>

      {selected.size > 0 && (
        <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-900">{selected.size} selected</span>
          <label className="flex items-center gap-1.5 text-slate-900 cursor-pointer">
            <input type="checkbox" checked={bulk.useStatus} onChange={(e) => setBulk({ ...bulk, useStatus: e.target.checked })} className="h-4 w-4" />
            Status
          </label>
          <select value={bulk.status} disabled={!bulk.useStatus} onChange={(e) => setBulk({ ...bulk, status: e.target.value })}
            className="rounded-md border border-slate-400 px-2 py-1 text-sm disabled:opacity-50">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-slate-900 cursor-pointer ml-2">
            <input type="checkbox" checked={bulk.useLocation} onChange={(e) => setBulk({ ...bulk, useLocation: e.target.checked })} className="h-4 w-4" />
            Location
          </label>
          <select value={bulk.center} disabled={!bulk.useLocation} onChange={(e) => setBulk({ ...bulk, center: e.target.value, department: "" })}
            className="rounded-md border border-slate-400 px-2 py-1 text-sm disabled:opacity-50">
            <option value="">Center...</option>
            {centers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={bulk.department} disabled={!bulk.useLocation || !bulk.center} onChange={(e) => setBulk({ ...bulk, department: e.target.value })}
            className="rounded-md border border-slate-400 px-2 py-1 text-sm disabled:opacity-50">
            <option value="">Department...</option>
            {departmentsFor(bulk.center).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="button" onClick={applyBulk} className="rounded-md bg-blue-600 text-white text-sm font-medium px-3 py-1 hover:bg-blue-700">
            Apply to {selected.size}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-3 py-1 hover:bg-slate-50">
            Clear selection
          </button>
          <span className="text-slate-500">|</span>
          <button type="button" onClick={() => startEdit(items.filter((i) => selected.has(i.id)))}
            className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-3 py-1 hover:bg-slate-50">
            Edit selected rows
          </button>
        </div>
      )}

      {editCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-3 text-sm">
          <span className="text-amber-800">{editCount} row(s) being edited — change names, IDs, emails, etc. directly in the table.</span>
          <button type="button" onClick={saveAllEdits} className="rounded-md bg-blue-600 text-white text-sm font-medium px-3 py-1 hover:bg-blue-700">
            Save all ({editCount})
          </button>
          <button type="button" onClick={() => setEdits({})} className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-3 py-1 hover:bg-slate-50">
            Cancel all
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left pb-2 w-6">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allFilteredSelected}
                  onChange={(e) => filtered.forEach((i) => toggleSelected(i.id, e.target.checked))}
                  className="h-4 w-4"
                />
              </th>
              <th className="text-left pb-2">Employee ID</th>
              <th className="text-left pb-2">Full Name</th>
              <th className="text-left pb-2">Email</th>
              <th className="text-left pb-2">Center</th>
              <th className="text-left pb-2">Department</th>
              <th className="text-left pb-2">Status</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className={needsReview(item) ? "bg-amber-50" : ""}>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.fullName}`}
                    checked={selected.has(item.id)}
                    onChange={(e) => toggleSelected(item.id, e.target.checked)}
                    className="h-4 w-4"
                  />
                </td>
                {edits[item.id] ? (
                  <>
                    <td className="py-2 pr-2">
                      <input value={edits[item.id].employeeId} onChange={(e) => setEditField(item.id, { employeeId: e.target.value })}
                        className="w-full rounded-md border border-slate-400 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={edits[item.id].fullName} onChange={(e) => setEditField(item.id, { fullName: e.target.value })}
                        className="w-full rounded-md border border-slate-400 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={edits[item.id].email} onChange={(e) => setEditField(item.id, { email: e.target.value })}
                        className="w-full rounded-md border border-slate-400 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-2 pr-2">
                      <select value={edits[item.id].center}
                        onChange={(e) => setEditField(item.id, { center: e.target.value, department: "" })}
                        className="w-full rounded-md border border-slate-400 px-2 py-1 text-sm">
                        <option value="">—</option>
                        {centers.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select value={edits[item.id].department}
                        onChange={(e) => setEditField(item.id, { department: e.target.value })}
                        disabled={!edits[item.id].center}
                        className="w-full rounded-md border border-slate-400 px-2 py-1 text-sm disabled:bg-slate-50">
                        <option value="">—</option>
                        {departmentsFor(edits[item.id].center).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select value={edits[item.id].status} onChange={(e) => setEditField(item.id, { status: e.target.value })}
                        className="w-full rounded-md border border-slate-400 px-2 py-1 text-sm">
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => saveEdit(item)} className="text-xs text-blue-600 hover:underline mr-3">Save</button>
                      <button onClick={() => cancelEdit(item.id)} className="text-xs text-slate-500 hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-2 text-slate-600">{item.employeeId}</td>
                    <td className="py-2 pr-2 text-slate-900">
                      {item.fullName}
                      {needsReview(item) && <span className="text-amber-700 font-semibold ml-1" title="Missing or unclear Center/Department">*</span>}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">{item.email ?? "—"}</td>
                    <td className={`py-2 pr-2 ${needsReview(item) ? "text-amber-700 font-medium" : "text-slate-600"}`}>{item.center ?? "—"}</td>
                    <td className={`py-2 pr-2 ${needsReview(item) ? "text-amber-700 font-medium" : "text-slate-600"}`}>{item.department ?? "—"}</td>
                    <td className="py-2 pr-2 text-slate-600">{item.status}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => startEdit([item])} className="text-xs text-slate-500 hover:text-slate-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(item)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
