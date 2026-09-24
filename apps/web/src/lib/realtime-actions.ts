"use server";

import { requireMember } from "./guards";
import { createRealtimeToken } from "./realtime-token";

/** Issue a short-lived realtime token for the signed-in member of this tenant. */
export async function getRealtimeToken(): Promise<string> {
  const { userId, tenantId } = await requireMember();
  const secret = process.env.REALTIME_INTERNAL_SECRET;
  if (!secret) throw new Error("Realtime is not configured");
  return createRealtimeToken(userId, tenantId, secret);
}
