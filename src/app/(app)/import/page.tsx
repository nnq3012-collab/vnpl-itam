import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";
import ImportClient from "./client";

export default async function ImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.IT && session.role !== Role.HR) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">CSV/Excel import is restricted to IT and HR.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">CSV/Excel Import</h1>
      <ImportClient role={session.role} />
    </div>
  );
}
