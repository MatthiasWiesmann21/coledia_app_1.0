import { prisma as realPrisma } from "@coledia/db";
import type { PrismaMock } from "./prisma-mock";
import { testState } from "./state";

/** The mocked Prisma client (see setup.ts). */
export const prisma = realPrisma as unknown as PrismaMock;

export const TENANT = "tenant-a";
export const OTHER_TENANT = "tenant-b";

/**
 * Sign in as `userId` with `role` in the current tenant. Membership lookups for
 * any other user/tenant combination resolve to null.
 */
export function signInAs(role: string, userId = "user-1", extra: { id: string; role: string }[] = []) {
  testState.userId = userId;
  const members = new Map<string, string>([[userId, role], ...extra.map((e) => [e.id, e.role] as [string, string])]);
  prisma.membership.findUnique.mockImplementation(
    async (args: { where: { userId_tenantId?: { userId: string; tenantId: string } } }) => {
      const key = args.where.userId_tenantId;
      if (!key || key.tenantId !== TENANT || !members.has(key.userId)) return null;
      return { id: `m-${key.userId}`, userId: key.userId, tenantId: TENANT, role: members.get(key.userId), lastSeenAt: null };
    },
  );
}

export function signOut() {
  testState.userId = null;
}

/** Set the current tenant's plan (used by getTenantPlan / tenantHasFeature). */
export function withPlan(plan: "starter" | "club" | "organization") {
  prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan });
}
