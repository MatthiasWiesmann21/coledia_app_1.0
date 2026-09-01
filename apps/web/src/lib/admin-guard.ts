import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { redirect } from "next/navigation";

/**
 * Verify the current user has admin privileges (owner, admin, or operator).
 * Call this at the top of any admin page server component.
 * Redirects to /dashboard if not authorized.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: session.user.id,
        tenantId: getTenantId(),
      },
    },
  });

  if (
    !membership ||
    !["owner", "admin", "operator"].includes(membership.role)
  ) {
    redirect("/dashboard");
  }

  return { session, membership, tenantId: getTenantId() };
}
