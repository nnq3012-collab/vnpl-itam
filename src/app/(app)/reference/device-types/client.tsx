"use client";

import { useState } from "react";

type DeviceType = { id: string; name: string; hasSpecs: boolean; depreciationMonths: number | null };

export default function DeviceTypesClient({ initial }: { initial: DeviceType[] }) {
  const [items, setItems] = useState(initial);
  const [newName, setNewName] = useState("");
  const [newHasSpecs, setNewHasSpecs] = useState(false);
  const [newDepreciationMonths, setNewDepreciationMonths] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/reference/device-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        hasSpecs: newHasSpecs,
        depreciationMonths: newDepreciationMonths ? Number(newDepreciationMonths) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => [...prev, data.deviceType].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewHasSpecs(false);
    setNewDepreciationMonths("");
  }

  async function toggleHasSpecs(item: DeviceType) {
    setError(null);
    const res = await fetch(`/api/reference/device-types/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.name, hasSpecs: !item.hasSpecs, depreciationMonths: item.depreciationMonths }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.map((i) => (i.id === item.id ? data.deviceType : i)));
  }

  async function saveDepreciationMonths(item: DeviceType, value: string) {
    setError(null);
    const depreciationMonths = value ? Number(value) : null;
    const res = await fetch(`/api/reference/device-types/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.name, hasSpecs: item.hasSpecs, depreciationMonths }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.map((i) => (i.id === item.id ? data.deviceType : i)));
  }

  async function saveName(item: DeviceType) {
    setError(null);
    const res = await fetch(`/api/reference/device-types/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim(), hasSpecs: item.hasSpecs, depreciationMonths: item.depreciationMonths }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.map((i) => (i.id === item.id ? data.deviceType : i)));
    setEditingId(null);
  }

  async function handleDelete(item: DeviceType) {
    if (!confirm(`Delete "${item.name}"? This only works if no devices use this type.`)) return;
    setError(null);
    const res = await fetch(`/api/reference/device-types/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleAdd} className="space-y-2 pb-4 border-b border-slate-100">
        <p className="text-xs font-medium text-slate-500">Add Device Type</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Printer"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              required
            />
          </div>
          <label className="inline-flex items-center gap-2 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newHasSpecs}
              onChange={(e) => setNewHasSpecs(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-xs text-slate-600">Has CPU/RAM/Storage</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Depreciation (months)</label>
            <input
              type="number"
              min={1}
              value={newDepreciationMonths}
              onChange={(e) => setNewDepreciationMonths(e.target.value)}
              placeholder="e.g. 36"
              className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
            Add
          </button>
        </div>
      </form>

      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left pb-2">Name</th>
            <th className="text-left pb-2">Shows CPU/RAM/Storage fields</th>
            <th className="text-left pb-2">Depreciation (months)</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="py-2 pr-2">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => saveName(item)}
                    onKeyDown={(e) => e.key === "Enter" && saveName(item)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingName(item.name);
                    }}
                    className="text-slate-900 hover:underline text-left"
                  >
                    {item.name}
                  </button>
                )}
              </td>
              <td className="py-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.hasSpecs}
                    onChange={() => toggleHasSpecs(item)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-500">{item.hasSpecs ? "Yes" : "No"}</span>
                </label>
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min={1}
                  defaultValue={item.depreciationMonths ?? ""}
                  onBlur={(e) => saveDepreciationMonths(item, e.target.value)}
                  placeholder="Not set"
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </td>
              <td className="py-2 text-right">
                <button onClick={() => handleDelete(item)} className="text-xs text-red-500 hover:text-red-700">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        Click a name to rename it. Toggle the checkbox to instantly control whether Register/Update Device shows
        CPU/RAM/Storage fields for that type.
      </p>
    </div>
  );
}
