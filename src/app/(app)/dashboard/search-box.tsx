"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBox() {
  const router = useRouter();
  const [assetId, setAssetId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId.trim()) return;
    router.push(`/devices?assetId=${encodeURIComponent(assetId.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
      <input
        type="text"
        value={assetId}
        onChange={(e) => setAssetId(e.target.value)}
        placeholder="e.g. LAP001"
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
