import { prisma } from "@coledia/db";
import { getTenantId } from "./tenant";

/**
 * Profiles are per tenant: the same account has an independent profile
 * (avatar, bio, username, status, language, terms acceptance) in each container.
 */

/** Unique selector for a user's profile in the current tenant. */
export function profileKey(userId: string, tenantId: string = getTenantId()) {
  return { userId_tenantId: { userId, tenantId } };
}

/** The user's profile in the current tenant (or null). */
export function getProfile(userId: string, tenantId: string = getTenantId()) {
  return prisma.userProfile.findUnique({ where: profileKey(userId, tenantId) });
}

/** Include clause for a user relation: only the profile of this tenant. */
export function tenantProfileInclude(tenantId: string) {
  return { profiles: { where: { tenantId }, take: 1 } } as const;
}

/** Pick the (single) tenant profile from a user loaded with tenantProfileInclude. */
export function pickProfile<T>(user: { profiles?: T[] } | null | undefined): T | null {
  return user?.profiles?.[0] ?? null;
}
