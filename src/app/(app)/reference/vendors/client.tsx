"use client";

import { useState } from "react";

type Vendor = { id: string; name: string };

export default function VendorsClient({ initial }: { initial: Vendor[] }) {
  const [items, setItems] = useState(initial);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/reference/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => [...prev, data.vendor].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
  }

  async function saveName(item: Vendor) {
    setError(null);
    const res = await fetch(`/api/reference/vendors/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => prev.map((i) => (i.id === item.id ? data.vendor : i)));
    setEditingId(null);
  }

  async function handleDelete(item: Vendor) {
    if (!confirm(`Delete "${item.name}"? This only works if no devices use this vendor.`)) return;
    setError(null);
    const res = await fetch(`/api/reference/vendors/${item.id}`, { method: "DELETE" });
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
            <th className="text-left pb-2">Name</th>
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
              <td className="py-2 text-right">
                <button onClick={() => handleDelete(item)} className="text-xs text-red-500 hover:text-red-700">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleAdd} className="flex items-end gap-3 pt-2 border-t border-slate-100">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">New Vendor</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Dell"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            required
          />
        </div>
        <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
          Add
        </button>
      </form>
      <p className="text-xs text-slate-400">Click a name to rename it.</p>
    </div>
  );
}
