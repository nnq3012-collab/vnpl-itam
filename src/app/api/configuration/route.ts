import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireConfigAdmin } from "@/lib/api-guard";
import { getAllFeatureRoles } from "@/lib/feature-access";
import { FEATURES } from "@/lib/features";
import { Role } from "@prisma/client";

export async function GET() {
  const guard = await requireConfigAdmin();
  if ("error" in guard) return guard.error;

  const roleMap = await getAllFeatureRoles();
  const features = FEATURES.map((f) => ({
    key: f.key,
    label: f.label,
    description: f.description,
    defaultRoles: f.defaultRoles,
    roles: roleMap[f.key],
  }));
  return NextResponse.json({ features });
}

export async function PUT(request: NextRequest) {
  const guard = await requireConfigAdmin();
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  const roles = Array.isArray(body?.roles) ? body.roles : null;

  const feature = FEATURES.find((f) => f.key === key);
  if (!feature) return NextResponse.json({ error: "Unknown feature key" }, { status: 400 });
  if (!roles || !roles.every((r: unknown) => typeof r === "string" && Object.values(Role).includes(r as Role))) {
    return NextResponse.json({ error: "Invalid roles list" }, { status: 400 });
  }

  const permission = await prisma.featurePermission.upsert({
    where: { key },
    create: { key, roles },
    update: { roles },
  });

  return NextResponse.json({ roles: permission.roles });
}
