import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getAllFeatureRoles } from "@/lib/feature-access";
import { canConfigureFeatures } from "@/lib/rbac";
import NavDropdown from "./nav-dropdown";
import AdminMenu from "./admin-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // One query for every feature instead of one per nav item.
  const featureRoles = await getAllFeatureRoles();
  const can = (key: string) => featureRoles[key].includes(session.role);
  const canRegister = can("devices.register");
  const canImportAnything = can("import.devices") || can("import.employees");
  const canConfigure = canConfigureFeatures(session.username);
  const canUpdate = can("devices.edit") || can("devices.assign");
  const canManageReference = can("reference.deviceTypesAndVendors") || can("reference.employeesAndLocations");

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
    ...(canConfigure ? [{ href: "/logs/activity", label: "Activity Log" }] : []),
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
          <AdminMenu label={`${session.fullName} (${session.role})`} showConfiguration={canConfigure} />
        </div>
      </header>
      <main className="print:max-w-none print:p-0 max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
