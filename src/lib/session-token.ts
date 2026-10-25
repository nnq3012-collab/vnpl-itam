/** Shared by session.ts and proxy.ts. Kept free of `server-only` and
 * next/headers so the proxy can import it. */
export const SESSION_COOKIE = "itam_session";

export function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}
