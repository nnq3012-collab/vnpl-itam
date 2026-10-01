"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Combobox from "../combobox";

type DeviceType = { id: string; name: string; hasSpecs: boolean };
type Location = { id: string; center: string; department: string };
type Employee = { id: string; fullName: string; email: string | null; employeeId: string };
type Vendor = { id: string; name: string };

export default function RegisterDeviceForm({
  deviceTypes,
  locations,
  employees,
  vendors,
}: {
  deviceTypes: DeviceType[];
  locations: Location[];
  employees: Employee[];
  vendors: Vendor[];
}) {
  const router = useRouter();

  const [assetId, setAssetId] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [cpu, setCpu] = useState("");
  const [ram, setRam] = useState("");
  const [storage, setStorage] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [center, setCenter] = useState("");
  const [department, setDepartment] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [price, setPrice] = useState("");
  const [purchaseYear, setPurchaseYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const centers = useMemo(() => Array.from(new Set(locations.map((l) => l.center))).sort(), [locations]);
  const departmentsForCenter = useMemo(
    () => locations.filter((l) => l.center === center).map((l) => l.department).sort(),
    [locations, center]
  );

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ id: e.id, label: e.fullName, sublabel: e.email ?? e.employeeId })),
    [employees]
  );
  const selectedEmployee = employees.find((e) => e.id === assignedUserId) ?? null;
  const selectedDeviceType = deviceTypes.find((t) => t.id === deviceTypeId) ?? null;

  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  useEffect(() => {
    setSuggestedId(null);
    if (!deviceTypeId) return;
    let cancelled = false;
    fetch(`/api/devices/suggest-asset-id?deviceTypeId=${encodeURIComponent(deviceTypeId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSuggestedId(data.suggestedId ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deviceTypeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          deviceTypeId,
          makeModel,
          cpu,
          ram,
          storage,
          serialNumber,
          center,
          department,
          assignedUserId,
          vendorId: vendorId || null,
          price: price ? Number(price) : null,
          purchaseYear: purchaseYear ? Number(purchaseYear) : null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to register device");
        return;
      }

      setSuccess(`Device "${assetId}" registered successfully.`);
      setAssetId("");
      setDeviceTypeId("");
      setMakeModel("");
      setCpu("");
      setRam("");
      setStorage("");
      setSerialNumber("");
      setCenter("");
      setDepartment("");
      setAssignedUserId(null);
      setVendorId("");
      setPrice("");
      setPurchaseYear("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Asset ID</label>
        <input
          type="text"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
          required
        />
        {suggestedId && (
          <p className="text-xs text-slate-500 mt-1">
            Next available for this type:{" "}
            <button
              type="button"
              onClick={() => setAssetId(suggestedId)}
              className="text-blue-600 hover:underline font-medium"
            >
              {suggestedId}
            </button>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Device Type</label>
        <select
          value={deviceTypeId}
          onChange={(e) => setDeviceTypeId(e.target.value)}
          className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
          required
        >
          <option value="">Select...</option>
          {deviceTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Make/Model</label>
        <input
          type="text"
          value={makeModel}
          onChange={(e) => setMakeModel(e.target.value)}
          className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
        />
      </div>

      {selectedDeviceType?.hasSpecs && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CPU</label>
            <input
              type="text"
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RAM</label>
            <input
              type="text"
              value={ram}
              onChange={(e) => setRam(e.target.value)}
              placeholder="e.g. 16GB"
              className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Storage</label>
            <input
              type="text"
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              placeholder="e.g. 256GB SSD"
              className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
        <input
          type="text"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Center</label>
          <select
            value={center}
            onChange={(e) => {
              setCenter(e.target.value);
              setDepartment("");
            }}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
            required
          >
            <option value="">Select...</option>
            {centers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
            required
            disabled={!center}
          >
            <option value="">Select...</option>
            {departmentsForCenter.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Assigned User</label>
        <Combobox
          options={employeeOptions}
          value={assignedUserId}
          onChange={setAssignedUserId}
          placeholder="Type a name to search..."
          allowUnassigned
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Assigned User Email</label>
        <input
          type="text"
          value={selectedEmployee?.email ?? ""}
          readOnly
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Year</label>
          <input
            type="number"
            min={2000}
            max={2100}
            value={purchaseYear}
            onChange={(e) => setPurchaseYear(e.target.value)}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Registering..." : "Register Device"}
      </button>
    </form>
  );
}
