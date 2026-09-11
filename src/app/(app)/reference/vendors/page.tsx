import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";
import { prisma } from "@/lib/prisma";
import VendorsClient from "./client";

export default async function VendorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canUseFeature(session.role, "reference.deviceTypesAndVendors"))) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">You do not have permission to manage Vendors.</p>
      </div>
    );
  }

  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Vendors</h1>
      <VendorsClient initial={vendors.map((v) => ({ id: v.id, name: v.name }))} />
    </div>
  );
}
