import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";
import ImportClient from "./client";

export default async function ImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [canImportDevices, canImportEmployees] = await Promise.all([
    canUseFeature(session.role, "import.devices"),
    canUseFeature(session.role, "import.employees"),
  ]);
  if (!canImportDevices && !canImportEmployees) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">You do not have permission to use CSV/Excel import.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">CSV/Excel Import</h1>
      <ImportClient canImportDevices={canImportDevices} canImportEmployees={canImportEmployees} />
    </div>
  );
}
