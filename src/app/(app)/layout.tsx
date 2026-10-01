import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";
import { canConfigureFeatures } from "@/lib/rbac";
import NavDropdown from "./nav-dropdown";
import AdminMenu from "./admin-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [canRegister, canManageTypesAndVendors, canManageEmployeesAndLocations, canImportAnything] = await Promise.all([
    canUseFeature(session.role, "devices.register"),
    canUseFeature(session.role, "reference.deviceTypesAndVendors"),
    canUseFeature(session.role, "reference.employeesAndLocations"),
    Promise.all([
      canUseFeature(session.role, "import.devices"),
      canUseFeature(session.role, "import.employees"),
    ]).then(([a, b]) => a || b),
  ]);
  const canConfigure = canConfigureFeatures(session.username);
  const canUpdate = session.role === "IT" || session.role === "HR";
  const canManageReference = canManageTypesAndVendors || canManageEmployeesAndLocations;

  const devicesGroup = [
    { href: "/devices", label: "Device Master" },
    { href: "/logs/allocation", label: "Allocation & Return Log" },
    { href: "/batches", label: "Batches" },
  ];
  const actionsGroup = [
    ...(canRegister ? [{ href: "/devices/new", label: "Register Device" }] : []),
    ...(canUpdate ? [{ href: "/devices/update", label: "Update Device" }] : []),
  ];
  const dataGroup = [
    ...(canManageReference ? [{ href: "/reference", label: "Reference Lists" }] : []),
    ...(canImportAnything ? [{ href: "/import", label: "Import" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-print bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">VNPL ITAM</span>
            <nav className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
                Dashboard
              </Link>
              <NavDropdown label="Devices" items={devicesGroup} />
              {actionsGroup.length > 0 && <NavDropdown label="Actions" items={actionsGroup} />}
              {dataGroup.length > 0 && <NavDropdown label="Data" items={dataGroup} />}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {session.fullName} <span className="text-slate-500">({session.role})</span>
            </span>
            <AdminMenu showConfiguration={canConfigure} />
          </div>
        </div>
      </header>
      <main className="print:max-w-none print:p-0 max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
