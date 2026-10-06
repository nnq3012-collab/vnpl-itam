"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestoreButton({ logId, assetId }: { logId: string; assetId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm(`Restore deleted device ${assetId} with all its details as they were when deleted?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/logs/${logId}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error ?? "Failed to restore device");
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
      className="rounded-md border border-slate-400 bg-white text-xs font-medium text-slate-900 px-2 py-0.5 hover:bg-slate-50 disabled:opacity-50"
    >
      {busy ? "Restoring..." : "Restore"}
    </button>
  );
}
