"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Batch = { id: string; name: string; createdAt: string; deviceCount: number; breakdown: string };

export default function BatchesClient({ batches, canManage }: { batches: Batch[]; canManage: boolean }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body?: object) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (await send("/api/batches", "POST", { name: newName.trim() })) setNewName("");
  }

  async function saveName(item: Batch) {
    if (editingName.trim() && editingName.trim() !== item.name) {
      if (!(await send(`/api/batches/${item.id}`, "PUT", { name: editingName.trim() }))) return;
    }
    setEditingId(null);
  }

  async function handleDelete(item: Batch) {
    if (!confirm(`Delete batch "${item.name}"? Its ${item.deviceCount} device(s) are only unlinked from the batch — the devices and their history stay.`)) return;
    await send(`/api/batches/${item.id}`, "DELETE");
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage && (
        <form onSubmit={handleAdd} className="space-y-2 pb-4 border-b border-slate-100">
          <p className="text-xs font-medium text-slate-500">New Batch</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. 2026-Q4 Renovation – Branch A"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                required
              />
            </div>
            <button type="submit" className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700">
              Add
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left pb-2">Name</th>
            <th className="text-left pb-2">Created</th>
            <th className="text-right pb-2">Devices</th>
            <th className="text-left pb-2 pl-4">Status Breakdown</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {batches.map((item) => (
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
                ) : canManage ? (
                  <button
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingName(item.name);
                    }}
                    className="text-slate-900 hover:underline text-left"
                  >
                    {item.name}
                  </button>
                ) : (
                  <span className="text-slate-900">{item.name}</span>
                )}
              </td>
              <td className="py-2 pr-2 text-slate-500">{item.createdAt}</td>
              <td className="py-2 text-right text-slate-900">{item.deviceCount}</td>
              <td className="py-2 pl-4 text-slate-600">{item.breakdown || "—"}</td>
              <td className="py-2 text-right whitespace-nowrap">
                <Link href={`/devices?batchId=${item.id}`} className="text-xs text-blue-600 hover:underline">
                  View devices
                </Link>
                {canManage && (
                  <button onClick={() => handleDelete(item)} className="ml-3 text-xs text-red-500 hover:text-red-700">
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
          {batches.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-400">
                No batches yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        {canManage && "Click a name to rename it. "}Add devices to a batch from Device Master → select devices → Bulk Edit → Batch.
      </p>
    </div>
  );
}
