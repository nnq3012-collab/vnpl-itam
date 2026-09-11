import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";

export default async function ReferenceIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.IT && session.role !== Role.HR) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">
          Reference list management is restricted to IT and HR.
        </p>
      </div>
    );
  }

  const links = [
    ...(session.role === Role.IT
      ? [{ href: "/reference/device-types", label: "Device Types", desc: "Editable list of device categories (Laptop, PC, Monitor, ...) and whether they show CPU/RAM/Storage fields. IT only." }]
      : []),
    { href: "/reference/locations", label: "Locations", desc: "Center / Department pairs used across the app." },
    { href: "/reference/employees", label: "Employees", desc: "Employee directory used for device assignment." },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Reference Lists</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
            <div className="font-medium text-slate-900">{l.label}</div>
            <div className="text-xs text-slate-500 mt-1">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
