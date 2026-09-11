import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canConfigureFeatures } from "@/lib/rbac";
import { getAllFeatureRoles } from "@/lib/feature-access";
import { FEATURES } from "@/lib/features";
import ConfigurationClient from "./client";

export default async function ConfigurationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canConfigureFeatures(session.username)) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">Configuration is restricted to the IT admin account.</p>
      </div>
    );
  }

  const roleMap = await getAllFeatureRoles();

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose which roles can use each function. Changes take effect immediately for all users.
        </p>
      </div>
      <ConfigurationClient
        initial={FEATURES.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
          roles: roleMap[f.key],
        }))}
      />
    </div>
  );
}
