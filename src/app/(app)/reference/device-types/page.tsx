import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import DeviceTypesClient from "./client";

export default async function DeviceTypesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.IT) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">Restricted to IT.</p>
      </div>
    );
  }

  const deviceTypes = await prisma.deviceType.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Device Types</h1>
      <DeviceTypesClient initial={deviceTypes.map((t) => ({ id: t.id, name: t.name, hasSpecs: t.hasSpecs }))} />
    </div>
  );
}
