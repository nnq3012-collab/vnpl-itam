"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function AdminMenu({ showConfiguration }: { showConfiguration: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = pathname === "/configuration";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-sm inline-flex items-center gap-1 ${isActive ? "text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900"}`}
      >
        IT Admin (IT)
        <span className="text-xs text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white shadow-lg py-1 z-20">
          {showConfiguration && (
            <Link
              href="/configuration"
              onClick={() => setOpen(false)}
              className={`block px-3 py-1.5 text-sm hover:bg-slate-50 ${isActive ? "text-slate-900 font-medium" : "text-slate-600"}`}
            >
              Configuration
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="block w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
