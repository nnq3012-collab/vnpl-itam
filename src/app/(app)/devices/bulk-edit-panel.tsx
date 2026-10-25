"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { REASON_REQUIRED_STATUSES, STATUS_LABELS } from "@/lib/statuses";

type Vendor = { id: string; name: string };
type Location = { id: string; center: string; department: string };


function getSelectedAssetIds(): string[] {
  const checked = document.querySelectorAll<HTMLInputElement>(
    '#print-labels-form input[name="assetId"]:checked'
  );
  return Array.from(checked).map((cb) => cb.value);
}

export default function BulkEditPanel({
  vendors,
  locations,
  batches,
}: {
  vendors: Vendor[];
  locations: Location[];
  batches: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetIds, setAssetIds] = useState<string[]>([]);

  const [useStatus, setUseStatus] = useState(false);
  const [status, setStatus] = useState("IN_STOCK");
  const [reason, setReason] = useState("");

  const [useMakeModel, setUseMakeModel] = useState(false);
  const [makeModel, setMakeModel] = useState("");

  const [useLocation, setUseLocation] = useState(false);
  const [center, setCenter] = useState("");
  const [department, setDepartment] = useState("");

  const [useVendor, setUseVendor] = useState(false);
  const [vendorId, setVendorId] = useState("");

  const [usePrice, setUsePrice] = useState(false);
  const [price, setPrice] = useState("");

  const [usePurchaseYear, setUsePurchaseYear] = useState(false);
  const [purchaseYear, setPurchaseYear] = useState("");

  const [useBatch, setUseBatch] = useState(false);
  const [batchMode, setBatchMode] = useState<"add" | "remove">("add");
  const [batchName, setBatchName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const centers = Array.from(new Set(locations.map((l) => l.center))).sort();
  const departmentsForCenter = locations.filter((l) => l.center === center).map((l) => l.department).sort();

  function handleOpen() {
    const ids = getSelectedAssetIds();
    if (ids.length === 0) {
      alert("Check one or more devices in the list first.");
      return;
    }
    setAssetIds(ids);
    setError(null);
    setSuccess(null);
    setOpen(true);
  }

  const anyFieldSelected = useStatus || useMakeModel || useLocation || useVendor || usePrice || usePurchaseYear || useBatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!anyFieldSelected) {
      setError("Turn on at least one field to change.");
      return;
    }
    if (useLocation && (!center || !department)) {
      setError("Pick both Center and Department, or turn off Location.");
      return;
    }
    if (useBatch && !batchName.trim()) {
      setError("Enter a batch name, or turn off Batch.");
      return;
    }
    if (!confirm(`Apply these changes to ${assetIds.length} device(s)? This affects them all at once.`)) return;

    const payload: Record<string, unknown> = { assetIds };
    if (useStatus) {
      payload.status = status;
      if (reason.trim()) payload.reason = reason.trim();
    }
    if (useMakeModel) payload.makeModel = makeModel;
    if (useLocation) {
      payload.center = center;
      payload.department = department;
    }
    if (useVendor) payload.vendorId = vendorId || null;
    if (usePrice) payload.price = price ? Number(price) : null;
    if (usePurchaseYear) payload.purchaseYear = purchaseYear ? Number(purchaseYear) : null;
    if (useBatch) {
      payload.batchName = batchName.trim();
      payload.batchMode = batchMode;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/devices/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to bulk edit devices");
        return;
      }
      setSuccess(`Updated ${data.updated} device(s).${data.skipped ? ` ${data.skipped} already matched, left unchanged.` : ""}`);
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-4 py-1.5 hover:bg-slate-50"
      >
        Bulk Edit
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Bulk Edit {assetIds.length} Device(s)</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-700 text-sm">
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Turn on only the fields you want to change. Anything left off stays exactly as it is per device.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldToggle label="Status" checked={useStatus} onChange={setUseStatus}>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm">
                  {Object.entries(STATUS_LABELS).map(([s, label]) => <option key={s} value={s}>{label}</option>)}
                </select>
                {REASON_REQUIRED_STATUSES.includes(status) && (
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required for this status)"
                    className="w-full mt-2 rounded-md border border-slate-400 px-3 py-2 text-sm"
                    rows={2}
                  />
                )}
              </FieldToggle>

              <FieldToggle label="Make/Model" checked={useMakeModel} onChange={setUseMakeModel}>
                <input
                  type="text"
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  placeholder="e.g. Dell Latitude 5420"
                  className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
                />
              </FieldToggle>

              <FieldToggle label="Location" checked={useLocation} onChange={setUseLocation}>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={center}
                    onChange={(e) => { setCenter(e.target.value); setDepartment(""); }}
                    className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
                  >
                    <option value="">Center...</option>
                    {centers.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={!center}
                    className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm disabled:bg-slate-50"
                  >
                    <option value="">Department...</option>
                    {departmentsForCenter.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </FieldToggle>

              <FieldToggle label="Vendor" checked={useVendor} onChange={setUseVendor}>
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm">
                  <option value="">Unset</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </FieldToggle>

              <FieldToggle label="Price" checked={usePrice} onChange={setUsePrice}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
                />
              </FieldToggle>

              <FieldToggle label="Purchase Year" checked={usePurchaseYear} onChange={setUsePurchaseYear}>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={purchaseYear}
                  onChange={(e) => setPurchaseYear(e.target.value)}
                  className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
                />
              </FieldToggle>

              <FieldToggle label="Batch" checked={useBatch} onChange={setUseBatch}>
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <select
                    value={batchMode}
                    onChange={(e) => setBatchMode(e.target.value as "add" | "remove")}
                    className="rounded-md border border-slate-400 px-3 py-2 text-sm"
                  >
                    <option value="add">Add to</option>
                    <option value="remove">Remove from</option>
                  </select>
                  <input
                    type="text"
                    list="batch-names"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. 2026-10 RAM upgrade"
                    className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
                  />
                  <datalist id="batch-names">
                    {batches.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <p className="mt-1 text-xs text-slate-500">Pick an existing batch or type a new name to create it.</p>
              </FieldToggle>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-700">{success}</p>}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting || !anyFieldSelected}
                  className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Applying..." : `Apply to ${assetIds.length} device(s)`}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-400 bg-white text-sm font-medium text-slate-900 px-4 py-2 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function FieldToggle({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border ${checked ? "border-blue-300 bg-blue-50/40" : "border-slate-200"} p-3`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-400"
        />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </label>
      {checked && <div className="mt-2">{children}</div>}
    </div>
  );
}
