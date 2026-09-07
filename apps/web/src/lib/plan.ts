import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@coledia/db";
import {
  PLANS,
  PLAN_FEATURES,
  planHasFeature,
  getPlanLimits,
  minPlanForFeature,
  type Plan,
  type FeatureKey,
} from "@coledia/shared";
import { getTenantId } from "./tenant";

/**
 * Tenant plan helpers — gate features by subscription tier.
 *
 * `getTenantPlan` is wrapped in React cache() so multiple calls within the
 * same request (layout, page, components) only hit the DB once.
 */

export const getTenantPlan = cache(async (): Promise<Plan> => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: getTenantId() },
    select: { plan: true },
  });
  const plan = tenant?.plan;
  return (plan === PLANS.CLUB || plan === PLANS.ORGANIZATION ? plan : PLANS.STARTER) as Plan;
});

/** Whether the current tenant's plan includes a feature. Use in server components/actions. */
export async function hasFeature(feature: FeatureKey): Promise<boolean> {
  const plan = await getTenantPlan();
  return planHasFeature(plan, feature);
}

/**
 * Require a feature at the page level.
 * Redirects to /upgrade with context when the plan doesn't include it.
 * Call at the top of gated server pages, after auth checks.
 */
export async function requireFeature(feature: FeatureKey): Promise<Plan> {
  const plan = await getTenantPlan();
  if (!planHasFeature(plan, feature)) {
    redirect(`/upgrade?feature=${feature}`);
  }
  return plan;
}

/** Numeric limits for the current tenant's plan (null = unlimited). */
export async function getCurrentPlanLimits(): Promise<{
  plan: Plan;
  memberLimit: number | null;
  storageLimitBytes: number | null;
}> {
  const plan = await getTenantPlan();
  return { plan, ...getPlanLimits(plan) };
}

/**
 * Check a feature capacity for a tenant id directly (no request cache).
 * Use in API route handlers that authenticate by API key instead of session.
 */
export async function tenantHasFeature(tenantId: string, feature: FeatureKey): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  return planHasFeature(tenant?.plan ?? PLANS.STARTER, feature);
}

/**
 * Full feature map for the current plan — for passing to client components
 * (nav grey-out, upsell hints).
 */
export async function getPlanFeatureMap(): Promise<Record<FeatureKey, boolean>> {
  const plan = await getTenantPlan();
  const features = PLAN_FEATURES[plan];
  return {
    quizzesCertificates: features.quizzesCertificates,
    liveEvents: features.liveEvents,
    userGroups: features.userGroups,
    auditLogs: features.auditLogs,
    sellCourses: features.sellCourses,
    apiAccess: features.apiAccess,
    customPages: features.customPages,
  };
}

/** Minimum plan name required for a feature ("Club", "Organization") for UI labels. */
export function requiredPlanName(feature: FeatureKey): string {
  return minPlanForFeature(feature) === PLANS.CLUB ? "Club" : "Organization";
}
