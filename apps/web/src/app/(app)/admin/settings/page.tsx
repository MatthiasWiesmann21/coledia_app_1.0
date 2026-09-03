import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { SettingsPanel } from "@/components/admin/settings-panel";

export default async function AdminSettingsPage() {
  const { tenantId, membership } = await requireAdmin();

  const [tenant, apiKeys] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    }),
    prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!tenant) {
    return <div>Tenant not found</div>;
  }

  const isOwner = membership.role === "owner";

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <SettingsPanel
        tenant={{
          name: tenant.name,
          status: tenant.status,
          plan: tenant.plan,
        }}
        branding={tenant.branding
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
            }
          : null}
        apiKeys={apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
        isOwner={isOwner}
      />
    </div>
  );
}
