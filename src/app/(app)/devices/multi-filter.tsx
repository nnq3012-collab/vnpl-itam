"use client";

import { useEffect, useRef, useState } from "react";

/** Checkbox dropdown for the GET filter form — each checked box submits as a
 * repeated param (?name=a&name=b). Pass `onChange` to use it for client-side
 * filtering instead. Stays open while ticking; closes on an
 * outside click (including opening another filter) or Escape. The panel stays
 * mounted when closed so its checkboxes still submit with the form. */
export default function MultiFilter({
  label,
  name,
  options,
  selected,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange?: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ownChecked, setOwnChecked] = useState(selected);
  // With onChange the parent owns the selection (so it can clear it);
  // in the plain GET form this component keeps it.
  const checked = onChange ? selected : ownChecked;
  function update(next: string[]) {
    setOwnChecked(next);
    onChange?.(next);
  }
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const summary =
    checked.length === 0
      ? "All"
      : checked.length === 1
        ? options.find((o) => o.value === checked[0])?.label ?? "1 selected"
        : `${checked.length} selected`;

  return (
    <div ref={ref} className="relative">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900 min-w-32 max-w-48"
      >
        <span className="truncate">{summary}</span>
        <span className="text-slate-600 text-xs">▾</span>
      </button>
      <div
        className={`${open ? "" : "hidden "}absolute z-20 mt-1 max-h-64 min-w-48 overflow-y-auto rounded-md border border-slate-300 bg-white p-2 shadow-lg`}
      >
        {checked.length > 0 && (
          <button
            type="button"
            onClick={() => update([])}
            className="mb-1 w-full text-left px-1 py-0.5 text-xs font-medium text-blue-700 hover:underline"
          >
            Clear ({checked.length})
          </button>
        )}
        {options.length === 0 && <p className="text-xs text-slate-600 px-1">None yet</p>}
        {options.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-2 px-1 py-0.5 text-sm text-slate-900 whitespace-nowrap cursor-pointer hover:bg-slate-100"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={checked.includes(o.value)}
              onChange={(e) => update(e.target.checked ? [...checked, o.value] : checked.filter((v) => v !== o.value))}
              className="h-4 w-4"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
