"use client";

export default function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300"
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[name="assetId"]').forEach((cb) => {
          cb.checked = e.currentTarget.checked;
        });
      }}
    />
  );
}
