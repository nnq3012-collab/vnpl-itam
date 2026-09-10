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
