"use client";

import { useState } from "react";

type Feature = { key: string; label: string; description: string; roles: string[] };

const ALL_ROLES: { value: "IT" | "HR" | "FINANCE"; label: string }[] = [
  { value: "IT", label: "IT" },
  { value: "HR", label: "HR" },
  { value: "FINANCE", label: "Finance" },
];

export default function ConfigurationClient({ initial }: { initial: Feature[] }) {
  const [features, setFeatures] = useState(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleRole(feature: Feature, role: string) {
    setError(null);
    const nextRoles = feature.roles.includes(role)
      ? feature.roles.filter((r) => r !== role)
      : [...feature.roles, role];

    setSavingKey(feature.key);
    try {
      const res = await fetch("/api/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: feature.key, roles: nextRoles }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        return;
      }
      setFeatures((prev) => prev.map((f) => (f.key === feature.key ? { ...f, roles: data.roles } : f)));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow divide-y divide-slate-100">
      {error && <p className="text-sm text-red-600 px-6 pt-4">{error}</p>}
      {features.map((feature) => (
        <div key={feature.key} className="p-6 flex items-start justify-between gap-6">
          <div>
            <div className="font-medium text-slate-900">{feature.label}</div>
            <div className="text-xs text-slate-500 mt-1 max-w-md">{feature.description}</div>
          </div>
          <div className="flex gap-4 shrink-0">
            {ALL_ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feature.roles.includes(r.value)}
                  disabled={savingKey === feature.key}
                  onChange={() => toggleRole(feature, r.value)}
                  className="h-4 w-4 rounded border-slate-400"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
