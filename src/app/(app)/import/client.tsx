"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type DeviceImportRow = {
  assetId: string;
  deviceType: string;
  makeModel?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  serialNumber?: string;
  status?: string;
  center: string;
  department: string;
  assignedUserEmail?: string;
  assignedUserName?: string;
};

type EmployeeImportRow = {
  employeeId: string;
  fullName: string;
  email?: string;
  center?: string;
  department?: string;
};

function pick(row: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const key = keys.find((k) => k.trim().toLowerCase() === candidate.toLowerCase());
    if (key !== undefined) {
      const val = row[key];
      return val === undefined || val === null ? "" : String(val).trim();
    }
  }
  return "";
}

function findSheet(workbook: XLSX.WorkBook, candidates: string[]): string {
  const match = workbook.SheetNames.find((n) => candidates.some((c) => n.trim().toLowerCase() === c.toLowerCase()));
  return match ?? workbook.SheetNames[0];
}

export default function ImportClient({
  canImportDevices,
  canImportEmployees,
}: {
  canImportDevices: boolean;
  canImportEmployees: boolean;
}) {
  const [tab, setTab] = useState<"devices" | "employees">(canImportDevices ? "devices" : "employees");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200">
        {canImportDevices && (
          <button
            onClick={() => setTab("devices")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "devices" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Devices
          </button>
        )}
        {canImportEmployees && (
          <button
            onClick={() => setTab("employees")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "employees" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Employees
          </button>
        )}
      </div>
      {tab === "devices" && canImportDevices ? <DeviceImport /> : canImportEmployees ? <EmployeeImport /> : null}
    </div>
  );
}

function DeviceImport() {
  const [rows, setRows] = useState<DeviceImportRow[]>([]);
  const [sheetUsed, setSheetUsed] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: { assetId: string; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = findSheet(wb, ["DeviceMaster", "Device Master", "Devices"]);
        setSheetUsed(sheetName);
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });

        const parsed: DeviceImportRow[] = raw.map((r) => ({
          assetId: pick(r, ["Asset ID", "AssetId"]),
          deviceType: pick(r, ["Device Type", "DeviceType"]),
          makeModel: pick(r, ["Make/Model", "Make Model", "MakeModel"]),
          cpu: pick(r, ["CPU"]),
          ram: pick(r, ["RAM"]),
          storage: pick(r, ["Storage"]),
          serialNumber: pick(r, ["Serial Number", "SerialNumber"]),
          status: pick(r, ["Status"]),
          center: pick(r, ["Center", "Location"]),
          department: pick(r, ["Department"]),
          assignedUserEmail: pick(r, ["Assigned Email", "Assigned User Email", "AssignedEmail"]),
          assignedUserName: pick(r, ["Assigned User", "AssignedUser"]),
        }));
        setRows(parsed);
      } catch {
        setError("Could not parse this file. Make sure it's a valid .xlsx/.xls/.csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const seenAssetIds = new Set<string>();
  const rowIssues = rows.map((r) => {
    if (!r.assetId || !r.deviceType || !r.center || !r.department) return "Missing required field";
    if (seenAssetIds.has(r.assetId)) return "Duplicate Asset ID within this file";
    seenAssetIds.add(r.assetId);
    return null;
  });

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong during import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Upload Device Master file (.xlsx, .xls, .csv)</label>
        <a href="/api/import/devices/template" className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-4">
          Download template (.xlsx)
        </a>
      </div>
      <div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-sm" />
        {sheetUsed && <p className="text-xs text-slate-400 mt-1">Reading sheet: &quot;{sheetUsed}&quot;</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length > 0 && !result && (
        <>
          <p className="text-sm text-slate-600">
            Parsed {rows.length} row(s). {rowIssues.filter(Boolean).length} will be skipped due to issues shown below.
            Existing Asset IDs already in the system will also be skipped automatically on import.
          </p>
          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Asset ID</th>
                  <th className="px-2 py-1.5 text-left">Device Type</th>
                  <th className="px-2 py-1.5 text-left">Make/Model</th>
                  <th className="px-2 py-1.5 text-left">CPU</th>
                  <th className="px-2 py-1.5 text-left">RAM</th>
                  <th className="px-2 py-1.5 text-left">Storage</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5 text-left">Center</th>
                  <th className="px-2 py-1.5 text-left">Department</th>
                  <th className="px-2 py-1.5 text-left">Assigned User</th>
                  <th className="px-2 py-1.5 text-left">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className={rowIssues[i] ? "bg-red-50" : ""}>
                    <td className="px-2 py-1">{r.assetId || "—"}</td>
                    <td className="px-2 py-1">{r.deviceType || "—"}</td>
                    <td className="px-2 py-1 max-w-xs truncate">{r.makeModel || "—"}</td>
                    <td className="px-2 py-1">{r.cpu || "—"}</td>
                    <td className="px-2 py-1">{r.ram || "—"}</td>
                    <td className="px-2 py-1">{r.storage || "—"}</td>
                    <td className="px-2 py-1">{r.status || "—"}</td>
                    <td className="px-2 py-1">{r.center || "—"}</td>
                    <td className="px-2 py-1">{r.department || "—"}</td>
                    <td className="px-2 py-1">{r.assignedUserName || "—"}</td>
                    <td className="px-2 py-1 text-red-600">{rowIssues[i] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? "Importing..." : `Import ${rows.length} row(s)`}
          </button>
        </>
      )}

      {result && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 space-y-2">
          <p className="text-sm text-green-800 font-medium">Imported {result.imported} device(s).</p>
          {result.skipped.length > 0 && (
            <div>
              <p className="text-sm text-amber-700 font-medium">{result.skipped.length} row(s) skipped:</p>
              <ul className="text-xs text-amber-700 list-disc list-inside max-h-40 overflow-y-auto">
                {result.skipped.map((s, i) => (
                  <li key={i}>{s.assetId}: {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmployeeImport() {
  const [rows, setRows] = useState<EmployeeImportRow[]>([]);
  const [sheetUsed, setSheetUsed] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: { employeeId: string; reason: string }[]; unresolvedDepartments: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = findSheet(wb, ["Users", "Employees"]);
        setSheetUsed(sheetName);
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });

        const parsed: EmployeeImportRow[] = raw.map((r) => ({
          employeeId: pick(r, ["Employee ID", "EmployeeId"]),
          fullName: pick(r, ["Full Name", "FullName", "Name"]),
          email: pick(r, ["Email"]),
          center: pick(r, ["Center", "Location"]),
          department: pick(r, ["Department"]),
        }));
        setRows(parsed);
      } catch {
        setError("Could not parse this file. Make sure it's a valid .xlsx/.xls/.csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const rowIssues = rows.map((r) => (!r.employeeId || !r.fullName ? "Missing Employee ID or Full Name" : null));

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong during import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Upload Employee roster (.xlsx, .xls, .csv)</label>
        <a href="/api/import/employees/template" className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-4">
          Download template (.xlsx)
        </a>
      </div>
      <div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-sm" />
        {sheetUsed && <p className="text-xs text-slate-400 mt-1">Reading sheet: &quot;{sheetUsed}&quot;</p>}
      </div>

      <p className="text-xs text-slate-400">
        Safe to re-run: existing employees (matched by Employee ID) get their Name/Email/Department refreshed from
        the file. Their Active/Resigned/Transferred Status is never changed by import — only Update Device or the
        Employees reference list can change that.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length > 0 && !result && (
        <>
          <p className="text-sm text-slate-600">
            Parsed {rows.length} row(s). {rowIssues.filter(Boolean).length} will be skipped due to issues shown below.
          </p>
          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Employee ID</th>
                  <th className="px-2 py-1.5 text-left">Full Name</th>
                  <th className="px-2 py-1.5 text-left">Email</th>
                  <th className="px-2 py-1.5 text-left">Center</th>
                  <th className="px-2 py-1.5 text-left">Department</th>
                  <th className="px-2 py-1.5 text-left">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className={rowIssues[i] ? "bg-red-50" : ""}>
                    <td className="px-2 py-1">{r.employeeId || "—"}</td>
                    <td className="px-2 py-1">{r.fullName || "—"}</td>
                    <td className="px-2 py-1">{r.email || "—"}</td>
                    <td className="px-2 py-1">{r.center || "—"}</td>
                    <td className="px-2 py-1">{r.department || "—"}</td>
                    <td className="px-2 py-1 text-red-600">{rowIssues[i] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? "Importing..." : `Import ${rows.length} row(s)`}
          </button>
        </>
      )}

      {result && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 space-y-2">
          <p className="text-sm text-green-800 font-medium">
            Created {result.created}, updated {result.updated} employee(s).
          </p>
          {result.skipped.length > 0 && (
            <div>
              <p className="text-sm text-amber-700 font-medium">{result.skipped.length} row(s) skipped:</p>
              <ul className="text-xs text-amber-700 list-disc list-inside max-h-40 overflow-y-auto">
                {result.skipped.map((s, i) => (
                  <li key={i}>{s.employeeId}: {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {result.unresolvedDepartments.length > 0 && (
            <div>
              <p className="text-sm text-amber-700 font-medium">
                {result.unresolvedDepartments.length} Department name(s) didn&apos;t match any known Center/Department
                pair (employee was still saved, just without a Center/Department set — add the pairing in Reference
                Lists → Locations and re-import to fix):
              </p>
              <ul className="text-xs text-amber-700 list-disc list-inside max-h-40 overflow-y-auto">
                {result.unresolvedDepartments.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
