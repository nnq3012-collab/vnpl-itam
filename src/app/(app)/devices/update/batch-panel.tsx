"use client";

import { useState } from "react";

/** Add/remove this one device to/from batches. Saves immediately (separate
 * from "Save Changes") through the bulk-edit API with a single asset. */
export default function BatchPanel({
  assetId,
  initialBatches,
  allBatches,
}: {
  assetId: string;
  initialBatches: string[];
  allBatches: string[];
}) {
  const [batches, setBatches] = useState(initialBatches);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(batchName: string, batchMode: "add" | "remove") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/devices/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId], batchName, batchMode }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to update batch");
      setBatches((prev) => (batchMode === "add" ? [...prev, batchName] : prev.filter((b) => b !== batchName)));
      setName("");
    } finally {
      setBusy(false);
    }
  }

  const trimmed = name.trim();

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-slate-700">Batches</h2>
        <p className="text-xs text-slate-500">Changes here save immediately and are recorded in the device history.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {batches.length === 0 && <span className="text-sm text-slate-500">Not in any batch.</span>}
        {batches.map((b) => (
          <span key={b} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {b}
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm(`Remove ${assetId} from "${b}"?`) && change(b, "remove")}
              aria-label={`Remove from ${b}`}
              className="text-blue-700 hover:text-red-600 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          list="device-batch-names"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pick a batch or type a new name"
          className="flex-1 rounded-md border border-slate-400 px-3 py-1.5 text-sm"
        />
        <datalist id="device-batch-names">
          {allBatches.filter((b) => !batches.includes(b)).map((b) => <option key={b} value={b} />)}
        </datalist>
        <button
          type="button"
          disabled={busy || !trimmed || batches.includes(trimmed)}
          onClick={() => change(trimmed, "add")}
          className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          Add to batch
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
