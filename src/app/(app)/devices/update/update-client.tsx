"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Combobox from "../combobox";

type DeviceRow = {
  id: string;
  assetId: string;
  deviceTypeId: string;
  deviceTypeName: string;
  makeModel: string | null;
  cpu: string | null;
  ram: string | null;
  storage: string | null;
  serialNumber: string | null;
  status: string;
  center: string;
  department: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserStatus: string | null;
};
type DeviceType = { id: string; name: string; hasSpecs: boolean };
type Location = { id: string; center: string; department: string };
type Employee = { id: string; fullName: string; email: string | null; employeeId: string; status: string };

const STATUS_OPTIONS = ["IN_STOCK", "DEPLOYED", "IN_REPAIR", "LOST", "STOLEN", "BROKEN", "RETIRED"];
const REASON_REQUIRED = new Set(["LOST", "STOLEN", "BROKEN", "RETIRED"]);
const EMPLOYEE_STATUS_OPTIONS = ["ACTIVE", "RESIGNED", "TRANSFERRED"];

export default function UpdateDeviceClient({
  role,
  devices,
  deviceTypes,
  locations,
  employees,
  initialAssetId,
}: {
  role: "IT" | "HR" | "FINANCE";
  devices: DeviceRow[];
  deviceTypes: DeviceType[];
  locations: Location[];
  employees: Employee[];
  initialAssetId?: string;
}) {
  const router = useRouter();
  const preselected = initialAssetId ? devices.find((d) => d.assetId === initialAssetId) ?? null : null;
  const [selectedAssetDeviceId, setSelectedAssetDeviceId] = useState<string | null>(preselected?.id ?? null);
  const device = devices.find((d) => d.id === selectedAssetDeviceId) ?? null;

  const assetOptions = useMemo(
    () => devices.map((d) => ({ id: d.id, label: d.assetId, sublabel: `${d.deviceTypeName} — ${d.status}` })),
    [devices]
  );

  if (!device) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Asset ID</label>
        <Combobox
          options={assetOptions}
          value={selectedAssetDeviceId}
          onChange={setSelectedAssetDeviceId}
          placeholder="Type an Asset ID to search existing devices..."
        />
        <p className="text-xs text-slate-400 mt-2">
          Only existing, registered devices appear here — this confirms the Asset ID you pick is valid.
        </p>
      </div>
    );
  }

  return (
    <EditForm
      key={device.id}
      role={role}
      device={device}
      deviceTypes={deviceTypes}
      locations={locations}
      employees={employees}
      onBack={() => setSelectedAssetDeviceId(null)}
      onSaved={() => {
        router.refresh();
        setSelectedAssetDeviceId(null);
      }}
    />
  );
}

function EditForm({
  role,
  device,
  deviceTypes,
  locations,
  employees,
  onBack,
  onSaved,
}: {
  role: "IT" | "HR" | "FINANCE";
  device: DeviceRow;
  deviceTypes: DeviceType[];
  locations: Location[];
  employees: Employee[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const isIT = role === "IT";

  const [deviceTypeId, setDeviceTypeId] = useState(device.deviceTypeId);
  const [makeModel, setMakeModel] = useState(device.makeModel ?? "");
  const [cpu, setCpu] = useState(device.cpu ?? "");
  const [ram, setRam] = useState(device.ram ?? "");
  const [storage, setStorage] = useState(device.storage ?? "");
  const [serialNumber, setSerialNumber] = useState(device.serialNumber ?? "");
  const [status, setStatus] = useState(device.status);
  const [center, setCenter] = useState(device.center);
  const [department, setDepartment] = useState(device.department);
  const [reason, setReason] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string | null>(device.assignedUserId);
  const [employeeStatus, setEmployeeStatus] = useState<string>(device.assignedUserStatus ?? "");
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
  const reasonRequired = isIT && REASON_REQUIRED.has(status) && status !== device.status;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = {};
    if (isIT) {
      payload.deviceTypeId = deviceTypeId;
      payload.makeModel = makeModel;
      payload.cpu = cpu;
      payload.ram = ram;
      payload.storage = storage;
      payload.serialNumber = serialNumber;
      payload.status = status;
      payload.center = center;
      payload.department = department;
      if (reason) payload.reason = reason;
    }
    payload.assignedUserId = assignedUserId;
    if (employeeStatus) payload.employeeStatus = employeeStatus;

    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(device.assetId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update device");
        return;
      }

      setSuccess(`Device "${device.assetId}" updated successfully.`);
      setTimeout(onSaved, 800);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Editing <span className="font-semibold text-slate-900">{device.assetId}</span>
        </div>
        <button type="button" onClick={onBack} className="text-xs text-slate-500 hover:text-slate-800">
          ← Choose a different device
        </button>
      </div>

      {!isIT && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
          As HR, you can only change the Assigned User and that employee&apos;s Status. Other fields are shown
          read-only for context.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Device Type</label>
        <select
          value={deviceTypeId}
          onChange={(e) => setDeviceTypeId(e.target.value)}
          disabled={!isIT}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
        >
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
          disabled={!isIT}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>

      {selectedDeviceType?.hasSpecs && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CPU</label>
            <input type="text" value={cpu} onChange={(e) => setCpu(e.target.value)} disabled={!isIT}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RAM</label>
            <input type="text" value={ram} onChange={(e) => setRam(e.target.value)} disabled={!isIT}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Storage</label>
            <input type="text" value={storage} onChange={(e) => setStorage(e.target.value)} disabled={!isIT}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
        <input
          type="text"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          disabled={!isIT}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={!isIT}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {reasonRequired && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reason <span className="text-red-600">(required for this status)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Center</label>
          <select
            value={center}
            onChange={(e) => { setCenter(e.target.value); setDepartment(""); }}
            disabled={!isIT}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
          >
            {!isIT && <option value={center}>{center}</option>}
            {isIT && centers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={!isIT}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
          >
            {!isIT && <option value={department}>{department}</option>}
            {isIT && departmentsForCenter.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Assigned User</label>
        <Combobox
          options={employeeOptions}
          value={assignedUserId}
          onChange={(id) => {
            setAssignedUserId(id);
            const emp = employees.find((e) => e.id === id);
            setEmployeeStatus(emp?.status ?? "");
          }}
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

      {assignedUserId && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Employee Status</label>
          <select
            value={employeeStatus}
            onChange={(e) => setEmployeeStatus(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {EMPLOYEE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
