/** Checkbox dropdown for the GET filter form — each checked box submits as a
 * repeated param (?name=a&name=b). Native <details>, no client JS. */
export default function MultiFilter({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
}) {
  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <details className="relative">
        <summary className="list-none cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm min-w-32 max-w-48 truncate">
          {summary} <span className="text-slate-400 text-xs">▾</span>
        </summary>
        <div className="absolute z-20 mt-1 max-h-64 min-w-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {options.length === 0 && <p className="text-xs text-slate-400 px-1">None yet</p>}
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-1 py-0.5 text-sm whitespace-nowrap cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                name={name}
                value={o.value}
                defaultChecked={selected.includes(o.value)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {o.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
