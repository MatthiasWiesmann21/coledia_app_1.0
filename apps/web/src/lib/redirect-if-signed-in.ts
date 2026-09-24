import { redirect } from "next/navigation";
import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";

/**
 * Send already signed-in members of this tenant to the dashboard (used by the
 * sign-in / sign-up pages). Users without a membership here stay on the page so
 * they can switch accounts.
 */
export async function redirectIfSignedIn(): Promise<void> {
  const session = await getSession().catch(() => null);
  if (!session) return;

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId: getTenantId() } },
    select: { id: true },
  });
  if (membership) redirect("/dashboard");
}
