"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAINTENANCE_CATEGORIES } from "@/lib/audit-log-display";

export default function MaintenanceForm({
  assetId,
  onLogged,
  compact,
}: {
  assetId: string;
  /** Called after a successful log instead of router.refresh() — lets a
   * parent (e.g. the Update Device form) update its own state instead of
   * a full page refresh. */
  onLogged?: () => void;
  /** Tighter spacing/no card chrome, for embedding inside another form. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(assetId)}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category || undefined, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to log maintenance event");
        return;
      }
      setDescription("");
      setCategory("");
      setSuccess("Logged.");
      if (onLogged) onLogged();
      else router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? "space-y-2" : "bg-white rounded-lg shadow p-4 space-y-2"}
    >
      {!compact && <label className="block text-sm font-medium text-slate-700">Log Maintenance Event</label>}
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-slate-400 px-2 py-2 text-sm text-slate-700 shrink-0"
        >
          <option value="">No category</option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Replaced battery, cleaned fan"
          className="flex-1 rounded-md border border-slate-400 px-3 py-2 text-sm min-w-0"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 shrink-0"
        >
          {submitting ? "Saving..." : "Log"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
    </form>
  );
}
