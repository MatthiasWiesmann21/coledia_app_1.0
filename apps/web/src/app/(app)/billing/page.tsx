import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { getTenantId } from "@/lib/tenant";
import { getConnectAccountStatus } from "@/lib/stripe";
import { hasFeature, CONTROL_CENTER_URL } from "@/lib/plan";
import { BillingPanel } from "@/components/billing/billing-panel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { membership } = await requireAdmin();
  const tenantId = getTenantId();
  const isOwner = membership.role === "owner";

  const canSellCourses = await hasFeature("sellCourses");

  const [tenant, connectStatus] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
      },
    }),
    isOwner && canSellCourses
      ? getConnectAccountStatus(tenantId)
      : Promise.resolve(null),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Billing</h1>
      <BillingPanel
        plan={tenant?.plan ?? "starter"}
        status={tenant?.status ?? "active"}
        currentPeriodEnd={tenant?.currentPeriodEnd?.toISOString() ?? null}
        isOwner={isOwner}
        connectStatus={connectStatus}
        canSellCourses={canSellCourses}
        controlCenterUrl={CONTROL_CENTER_URL}
      />
    </div>
  );
}
