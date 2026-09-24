import { prisma } from "@coledia/db";

/**
 * Per-tenant presence. A member counts as "online" in a tenant when they were
 * seen in THAT tenant recently — sessions are per account (shared by all
 * containers), so they can't be used for this.
 */

/** A member counts as online when seen within this window. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Minimum interval between lastSeenAt writes for the same membership. */
const PRESENCE_THROTTLE_MS = 2 * 60 * 1000;

/** Cut-off date for "online" queries. */
export function onlineSince(): Date {
  return new Date(Date.now() - ONLINE_WINDOW_MS);
}

/** Record that a member is active in this tenant (throttled, fire-and-forget). */
export function touchPresence(membership: { id: string; lastSeenAt: Date | null }): void {
  const last = membership.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - last < PRESENCE_THROTTLE_MS) return;
  void prisma.membership
    .update({ where: { id: membership.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});
}
