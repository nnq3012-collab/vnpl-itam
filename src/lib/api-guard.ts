import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import { Role } from "@prisma/client";

/** Returns the session if it's an IT user, otherwise an error response to return immediately. */
export async function requireIT(): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.role !== Role.IT) return { error: NextResponse.json({ error: "Forbidden — IT only" }, { status: 403 }) };
  return { session };
}

/** Returns the session if it's IT or HR, otherwise an error response to return immediately.
 * Used for reference lists (Employees, Locations) and the Employees import,
 * which HR also needs to keep up to date — unlike Device Types / device
 * import / device deletion, which stay IT-only. */
export async function requireITorHR(): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.role !== Role.IT && session.role !== Role.HR) {
    return { error: NextResponse.json({ error: "Forbidden — IT or HR only" }, { status: 403 }) };
  }
  return { session };
}
