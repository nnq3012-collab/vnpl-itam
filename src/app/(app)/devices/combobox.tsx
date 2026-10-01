"use client";

import { useMemo, useState, useRef, useEffect } from "react";

export type ComboboxOption = {
  id: string;
  label: string;
  sublabel?: string;
};

export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
  allowUnassigned,
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q)
        )
      : options;
    return base.slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? query : selected?.label ?? (value === null && allowUnassigned ? "Unassigned" : "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        placeholder={placeholder ?? "Type to search..."}
        className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
          {allowUnassigned && (
            <li
              onMouseDown={() => {
                onChange(null);
                setQuery("");
                setOpen(false);
              }}
              className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-500"
            >
              Unassigned
            </li>
          )}
          {filtered.map((o) => (
            <li
              key={o.id}
              onMouseDown={() => {
                onChange(o.id);
                setQuery("");
                setOpen(false);
              }}
              className="px-3 py-2 hover:bg-slate-50 cursor-pointer"
            >
              <div className="font-medium text-slate-900">{o.label}</div>
              {o.sublabel && <div className="text-xs text-slate-500">{o.sublabel}</div>}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-slate-500">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}
