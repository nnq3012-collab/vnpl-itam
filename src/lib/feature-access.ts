import "server-only";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";
import { FEATURES, featureDefinition } from "./features";

/** Roles currently allowed to use `key` — the configured override if one
 * exists in the database, otherwise the hardcoded default. */
export async function getFeatureRoles(key: string): Promise<Role[]> {
  const override = await prisma.featurePermission.findUnique({ where: { key } });
  if (override) return override.roles;
  return featureDefinition(key)?.defaultRoles ?? [];
}

export async function canUseFeature(role: Role, key: string): Promise<boolean> {
  const roles = await getFeatureRoles(key);
  return roles.includes(role);
}

/** Batch fetch for pages that need to gate several nav items/sections at
 * once without one query per feature. */
export async function getAllFeatureRoles(): Promise<Record<string, Role[]>> {
  const overrides = await prisma.featurePermission.findMany();
  const overrideMap = new Map(overrides.map((o) => [o.key, o.roles]));
  const result: Record<string, Role[]> = {};
  for (const f of FEATURES) {
    result[f.key] = overrideMap.get(f.key) ?? f.defaultRoles;
  }
  return result;
}
