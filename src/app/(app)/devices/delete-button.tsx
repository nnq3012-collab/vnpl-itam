"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteDeviceButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete device "${assetId}"? This cannot be undone.`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(assetId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete device");
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
      onClick={handleDelete}
      disabled={busy}
      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
