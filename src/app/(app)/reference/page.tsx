import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";

export default async function ReferenceIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [canManageTypesAndVendors, canManageEmployeesAndLocations] = await Promise.all([
    canUseFeature(session.role, "reference.deviceTypesAndVendors"),
    canUseFeature(session.role, "reference.employeesAndLocations"),
  ]);

  if (!canManageTypesAndVendors && !canManageEmployeesAndLocations) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">You do not have permission to manage reference lists.</p>
      </div>
    );
  }

  const links = [
    ...(canManageTypesAndVendors
      ? [
          { href: "/reference/device-types", label: "Device Types", desc: "Editable list of device categories (Laptop, PC, Monitor, ...), whether they show CPU/RAM/Storage fields, and their depreciation period." },
          { href: "/reference/vendors", label: "Vendors", desc: "Editable list of vendors/suppliers used on Device Master." },
        ]
      : []),
    ...(canManageEmployeesAndLocations
      ? [
          { href: "/reference/locations", label: "Locations", desc: "Center / Department pairs used across the app." },
          { href: "/reference/employees", label: "Employees", desc: "Employee directory used for device assignment." },
        ]
      : []),
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
