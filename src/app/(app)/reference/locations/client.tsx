"use client";

import { useState } from "react";

type Location = { id: string; center: string; department: string };

export default function LocationsClient({ initial }: { initial: Location[] }) {
  const [items, setItems] = useState(initial);
  const [newCenter, setNewCenter] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCenter, setEditCenter] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function sortItems(list: Location[]) {
    return [...list].sort((a, b) => a.center.localeCompare(b.center) || a.department.localeCompare(b.department));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/reference/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center: newCenter.trim(), department: newDepartment.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => sortItems([...prev, data.location]));
    setNewCenter("");
    setNewDepartment("");
  }

  function startEdit(item: Location) {
    setEditingId(item.id);
    setEditCenter(item.center);
    setEditDepartment(item.department);
  }

  async function saveEdit(item: Location) {
    setError(null);
    const res = await fetch(`/api/reference/locations/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center: editCenter.trim(), department: editDepartment.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => sortItems(prev.map((i) => (i.id === item.id ? data.location : i))));
    setEditingId(null);
  }

  async function handleDelete(item: Location) {
    if (!confirm(`Delete "${item.center} / ${item.department}"? This only works if no devices use it.`)) return;
    setError(null);
    const res = await fetch(`/api/reference/locations/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left pb-2">Center</th>
            <th className="text-left pb-2">Department</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              {editingId === item.id ? (
                <>
                  <td className="py-2 pr-2">
                    <input value={editCenter} onChange={(e) => setEditCenter(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="py-2 pr-2">
                    <input value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => saveEdit(item)} className="text-xs text-blue-600 hover:underline mr-3">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:underline">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-2 pr-2 text-slate-900">{item.center}</td>
                  <td className="py-2 pr-2 text-slate-600">{item.department}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(item)} className="text-xs text-slate-500 hover:text-slate-800 mr-3">Edit</button>
                    <button onClick={() => handleDelete(item)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleAdd} className="flex items-end gap-3 pt-2 border-t border-slate-100">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Center</label>
          <input type="text" value={newCenter} onChange={(e) => setNewCenter(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" required />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
          <input type="text" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" required />
        </div>
        <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
          Add
        </button>
      </form>
    </div>
  );
}
