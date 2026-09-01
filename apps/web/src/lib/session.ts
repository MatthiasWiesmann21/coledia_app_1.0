import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * Get the current session on the server side.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Get the current session or throw if not authenticated.
 * Use in protected pages/actions.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
