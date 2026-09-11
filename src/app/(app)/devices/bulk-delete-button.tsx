"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BulkDeleteButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const checked = document.querySelectorAll<HTMLInputElement>(
      '#print-labels-form input[name="assetId"]:checked'
    );
    const assetIds = Array.from(checked).map((cb) => cb.value);

    if (assetIds.length === 0) {
      alert("Check one or more devices in the list first.");
      return;
    }
    if (!confirm(`Delete ${assetIds.length} device(s)? This cannot be undone.`)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/devices/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Failed to delete devices");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-md bg-red-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-red-700 disabled:opacity-50"
    >
      Delete Selected
    </button>
  );
}
