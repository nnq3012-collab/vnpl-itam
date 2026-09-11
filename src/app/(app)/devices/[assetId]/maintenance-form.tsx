"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MaintenanceForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(assetId)}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to log maintenance event");
        return;
      }
      setDescription("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-2">
      <label className="block text-sm font-medium text-slate-700">Log Maintenance Event</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Replaced battery, cleaned fan"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Log"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
