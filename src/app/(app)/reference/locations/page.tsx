import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";
import { prisma } from "@/lib/prisma";
import LocationsClient from "./client";

export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canUseFeature(session.role, "reference.employeesAndLocations"))) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">You do not have permission to manage Locations.</p>
      </div>
    );
  }

  const locations = await prisma.location.findMany({ orderBy: [{ center: "asc" }, { department: "asc" }] });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Locations</h1>
      <LocationsClient initial={locations.map((l) => ({ id: l.id, center: l.center, department: l.department }))} />
    </div>
  );
}
