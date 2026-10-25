import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canUseFeature } from "@/lib/feature-access";
import { prisma } from "@/lib/prisma";
import BatchesClient from "./client";
import { statusLabel } from "@/lib/statuses";


export default async function BatchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const canManage = await canUseFeature(session.role, "devices.bulkEdit");

  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: "desc" },
    include: { devices: { select: { status: true } } },
  });

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Batches</h1>
      <BatchesClient
        canManage={canManage}
        batches={batches.map((b) => {
          const counts = new Map<string, number>();
          for (const d of b.devices) counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
          return {
            id: b.id,
            name: b.name,
            createdAt: b.createdAt.toLocaleDateString(),
            deviceCount: b.devices.length,
            breakdown: Array.from(counts, ([status, n]) => `${n} ${statusLabel(status)}`).join(" · "),
          };
        })}
      />
    </div>
  );
}
