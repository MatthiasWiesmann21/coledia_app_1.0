import { cache } from "react";
import { prisma } from "@coledia/db";
import { ADMIN_ROLES } from "@coledia/shared";
import { getTenantId } from "./tenant";

/**
 * Per-tenant email verification gate.
 *
 * better-auth always signs users in after sign-up; whether they may use the
 * app before verifying is a tenant setting (Tenant.requireEmailVerification,
 * default false). Owners/admins/operators are never gated so a broken SMTP
 * setup can't lock the tenant out.
 */

export const getTenantAuthSettings = cache(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: getTenantId() },
    select: { requireEmailVerification: true },
  });
  return { requireEmailVerification: tenant?.requireEmailVerification ?? false };
});

/** Pure check — exported for tests. */
export function isVerificationRequired(
  requireEmailVerification: boolean,
  emailVerified: boolean | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!requireEmailVerification || emailVerified) return false;
  return !(role && (ADMIN_ROLES as string[]).includes(role));
}

/** Whether this signed-in user must verify their email before using the app. */
export async function needsEmailVerification(
  user: { emailVerified?: boolean | null },
  role: string | null | undefined,
): Promise<boolean> {
  if (user.emailVerified) return false;
  const { requireEmailVerification } = await getTenantAuthSettings();
  return isVerificationRequired(requireEmailVerification, user.emailVerified, role);
}

export const VERIFY_PENDING_PATH = "/verify-email?pending=1";
