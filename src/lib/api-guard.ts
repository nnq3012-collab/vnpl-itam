import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import { canUseFeature } from "./feature-access";
import { canConfigureFeatures } from "./rbac";

/** Returns the session if its role is currently allowed to use `featureKey`
 * (per Configuration overrides, falling back to the feature's hardcoded
 * default), otherwise an error response to return immediately. */
export async function requireFeature(
  featureKey: string
): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canUseFeature(session.role, featureKey))) {
    return { error: NextResponse.json({ error: "Forbidden — your role does not have access to this feature" }, { status: 403 }) };
  }
  return { session };
}

/** Returns the session if it's the dedicated configuration-admin account,
 * otherwise an error response to return immediately. */
export async function requireConfigAdmin(): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canConfigureFeatures(session.username)) {
    return { error: NextResponse.json({ error: "Forbidden — configuration access is restricted" }, { status: 403 }) };
  }
  return { session };
}
