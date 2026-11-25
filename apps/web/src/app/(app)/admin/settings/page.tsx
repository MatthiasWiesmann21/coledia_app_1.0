import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@coledia/db";
import { cn } from "@coledia/ui/lib/utils";
import { requireAdmin } from "@/lib/admin-guard";
import { GeneralSettings } from "@/components/admin/settings/general-settings";
import { NavigationSettings } from "@/components/admin/settings/navigation-settings";
import { AuthSettings } from "@/components/admin/settings/auth-settings";
import { ApiKeysPanel } from "@/components/admin/settings/api-keys-panel";
import { StorageStatusCard } from "@/components/admin/settings/storage-status-card";
import { WebhookManager } from "@/components/admin/webhook-manager";
import { getPlanFeatureMap, hasFeature } from "@/lib/plan";
import { getNavigationEntries } from "@/lib/navigation";
import type { NavEntry } from "@/lib/navigation-config";

const TABS = ["general", "navigation", "signup", "api"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantId, membership } = await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "general";
  const t = await getTranslations("settingsTabs");
  const isOwner = membership.role === "owner";

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { branding: true },
  });
  if (!tenant) {
    return <div>Tenant not found</div>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="Settings">
        {TABS.map((id) => (
          <Link
            key={id}
            href={id === "general" ? "/admin/settings" : `/admin/settings?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(id)}
          </Link>
        ))}
      </nav>

      {tab === "general" && (
        <div className="flex flex-col gap-6">
          <StorageStatusCard tenantId={tenantId} />
          <GeneralSettings
            tenant={{ name: tenant.name, status: tenant.status, plan: tenant.plan }}
            branding={
              tenant.branding
                ? {
                    logoLightUrl: tenant.branding.logoLightUrl,
                    logoDarkUrl: tenant.branding.logoDarkUrl,
                    logoClickUrl: tenant.branding.logoClickUrl,
                    faviconUrl: tenant.branding.faviconUrl,
                    primaryColorLight: tenant.branding.primaryColorLight,
                    primaryColorDark: tenant.branding.primaryColorDark,
                    navTextColorLight: tenant.branding.navTextColorLight,
                    navTextColorDark: tenant.branding.navTextColorDark,
                    navBgColorLight: tenant.branding.navBgColorLight,
                    navBgColorDark: tenant.branding.navBgColorDark,
                    themePreset: tenant.branding.themePreset,
                    themeMode: tenant.branding.themeMode,
                    themeLocked: tenant.branding.themeLocked,
                  }
                : null
            }
            isOwner={isOwner}
          />
        </div>
      )}

      {tab === "navigation" && <NavigationTab />}

      {tab === "signup" && (
        <AuthSettings
          requireEmailVerification={tenant.requireEmailVerification}
          smtpConfigured={!!process.env.SMTP_HOST}
        />
      )}

      {tab === "api" && <ApiTab tenantId={tenantId} isOwner={isOwner} />}
    </div>
  );
}

async function NavigationTab() {
  const [entries, planFeatures] = await Promise.all([getNavigationEntries(), getPlanFeatureMap()]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clean = entries.map(({ groupIds, ...e }) => e as NavEntry);
  return <NavigationSettings entries={clean} planFeatures={planFeatures} />;
}

async function ApiTab({ tenantId, isOwner }: { tenantId: string; isOwner: boolean }) {
  const [apiKeys, webhooks, apiAccess] = await Promise.all([
    prisma.apiKey.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    isOwner
      ? prisma.webhook.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    hasFeature("apiAccess"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <ApiKeysPanel
        apiKeys={apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
      {isOwner && (
        <WebhookManager
          webhooks={webhooks.map((w) => ({
            id: w.id,
            url: w.url,
            events: (w.events as string[]) ?? [],
            secret: w.secret,
            active: w.active,
            createdAt: w.createdAt.toISOString(),
          }))}
          apiAccess={apiAccess}
        />
      )}
    </div>
  );
}
