"use client";

import { useEffect, useState, type ReactNode } from "react";

export type TableColumn = {
  key: string;
  header: ReactNode;
};

export type TableRow = {
  key: string;
  rowClassName?: string;
  cells: Record<string, ReactNode>;
};

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" className="text-slate-400 shrink-0">
      <circle cx="5" cy="3" r="1.3" />
      <circle cx="11" cy="3" r="1.3" />
      <circle cx="5" cy="8" r="1.3" />
      <circle cx="11" cy="8" r="1.3" />
      <circle cx="5" cy="13" r="1.3" />
      <circle cx="11" cy="13" r="1.3" />
    </svg>
  );
}

export default function ReorderableTable({
  storageKey,
  pinnedColumn,
  columns,
  rows,
  emptyMessage,
  hint,
}: {
  storageKey: string;
  pinnedColumn?: TableColumn;
  columns: TableColumn[];
  rows: TableRow[];
  emptyMessage: string;
  hint?: string;
}) {
  const defaultOrder = columns.map((c) => c.key);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const savedOrder: string[] = JSON.parse(saved);
      const validKeys = new Set(defaultOrder);
      const filtered = savedOrder.filter((k) => validKeys.has(k));
      const missing = defaultOrder.filter((k) => !filtered.includes(k));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing column order from localStorage on mount, after SSR renders the default order
      setOrder([...filtered, ...missing]);
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persist(nextOrder: string[]) {
    setOrder(nextOrder);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextOrder));
    } catch {
      // ignore storage errors (private browsing, quota, etc.)
    }
  }

  function handleDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const next = [...order];
    const fromIdx = next.indexOf(dragKey);
    const toIdx = next.indexOf(targetKey);
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragKey);
    persist(next);
    setDragKey(null);
  }

  function resetOrder() {
    persist(defaultOrder);
  }

  const columnsByKey = new Map(columns.map((c) => [c.key, c]));
  const orderedColumns = order.map((k) => columnsByKey.get(k)).filter((c): c is TableColumn => !!c);
  const colSpan = orderedColumns.length + (pinnedColumn ? 1 : 0);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <span className="text-xs text-slate-400">
          {hint ? `${hint} ` : ""}Drag a column header to reorder columns.
        </span>
        <button
          type="button"
          onClick={resetOrder}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          Reset column order
        </button>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            {pinnedColumn && <th className="px-4 py-2 text-left">{pinnedColumn.header}</th>}
            {orderedColumns.map((col) => (
              <th
                key={col.key}
                draggable
                onDragStart={() => setDragKey(col.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
                className={`px-4 py-2 text-left cursor-move select-none ${dragKey === col.key ? "opacity-50" : ""}`}
                title="Drag to reorder"
              >
                <span className="inline-flex items-center gap-1.5">
                  <DragHandleIcon />
                  {col.header}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key} id={`row-${row.key}`} className={`hover:bg-slate-50 ${row.rowClassName ?? ""}`}>
              {pinnedColumn && <td className="px-4 py-2">{row.cells[pinnedColumn.key]}</td>}
              {orderedColumns.map((col) => (
                <td key={col.key} className="px-4 py-2">
                  {row.cells[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
