import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "./logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/devices", label: "Device Master" },
    ...(session.role === "IT" ? [{ href: "/devices/new", label: "Register Device" }] : []),
    ...(session.role === "IT" || session.role === "HR" ? [{ href: "/devices/update", label: "Update Device" }] : []),
    ...(session.role === "IT" || session.role === "HR" ? [{ href: "/reference", label: "Reference Lists" }] : []),
    ...(session.role === "IT" || session.role === "HR" ? [{ href: "/import", label: "Import" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-print bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">VNPL ITAM</span>
            <nav className="flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {session.fullName} <span className="text-slate-400">({session.role})</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="print:max-w-none print:p-0 max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
