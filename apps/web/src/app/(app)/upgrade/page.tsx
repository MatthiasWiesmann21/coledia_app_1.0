import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Lock, LayoutDashboard, ExternalLink } from "lucide-react";
import {
  minPlanForFeature,
  PLAN_DETAILS,
  PLAN_ORDER,
  PLANS,
  type FeatureKey,
} from "@coledia/shared";
import { getTenantPlan, CONTROL_CENTER_URL } from "@/lib/plan";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const { feature } = await searchParams;
  const t = await getTranslations("upgrade");
  const currentPlan = await getTenantPlan();

  const featureKey = feature as FeatureKey | undefined;
  const isMemberLimit = feature === "memberLimit";
  const hasFeatureKey =
    featureKey &&
    [
      "quizzesCertificates",
      "liveEvents",
      "userGroups",
      "auditLogs",
      "sellCourses",
      "apiAccess",
      "customPages",
    ].includes(featureKey);
  // memberLimit is numeric per plan — the required tier is the next one up
  const requiredPlan = isMemberLimit
    ? (PLAN_ORDER[PLAN_ORDER.indexOf(currentPlan) + 1] ?? PLANS.ORGANIZATION)
    : hasFeatureKey
      ? minPlanForFeature(featureKey)
      : null;
  const requiredPlanName = requiredPlan ? PLAN_DETAILS[requiredPlan].name : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {(hasFeatureKey || isMemberLimit) && requiredPlanName ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t(`features.${feature}`)}
            </span>{" "}
            {t("featureRequired", { plan: requiredPlanName })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {PLAN_DETAILS[currentPlan].name}
        </p>
      </div>
      <div className="flex gap-3">
        <a
          href={CONTROL_CENTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
        >
          {t("goToBilling")}
          <ExternalLink className="h-4 w-4" />
        </a>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" />
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
