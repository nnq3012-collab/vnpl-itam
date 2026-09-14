"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function NavDropdown({ label, items }: { label: string; items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-sm inline-flex items-center gap-1 ${isActive ? "text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900"}`}
      >
        {label}
        <span className="text-xs text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[200px] rounded-md border border-slate-200 bg-white shadow-lg py-1 z-20">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-3 py-1.5 text-sm hover:bg-slate-50 ${pathname === item.href ? "text-slate-900 font-medium" : "text-slate-600"}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
