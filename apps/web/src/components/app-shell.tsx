import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { getPlanFeatureMap } from "@/lib/plan";
import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/confirm-provider";
import { TenantThemeProvider, type TenantBranding } from "@coledia/ui";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { NextIntlClientProvider } from "next-intl";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();

  // Fetch tenant + branding + profile + membership in parallel
  const [tenant, profile, membership] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: session.user.id,
          tenantId,
        },
      },
    }),
  ]);

  if (!tenant) {
    redirect("/sign-in");
  }

  const locale: Locale =
    profile?.language && isLocale(profile.language) ? profile.language : defaultLocale;
  const messages = await getMessages(locale);

  // Resolve tenant theme mode (defaults to "dark" for backwards compat)
  const themeMode = tenant.branding?.themeMode ?? "dark";

  // Build branding object for TenantThemeProvider
  const branding: TenantBranding | null = tenant.branding
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
    : null;

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin" || membership?.role === "operator";
  const isOwner = membership?.role === "owner";
  const planFeatures = await getPlanFeatureMap();

  return (
    <ThemeProvider defaultTheme={themeMode}>
      <TenantThemeProvider branding={branding}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ConfirmProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              <Sidebar
                isAdmin={isAdmin}
                tenantName={tenant.name}
                tenantLogoUrl={tenant.branding?.logoLightUrl ?? tenant.branding?.logoDarkUrl}
                logoClickUrl={tenant.branding?.logoClickUrl ?? null}
                planFeatures={planFeatures}
              />
              <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav
                  userName={session.user.name ?? "User"}
                  userEmail={session.user.email}
                  userAvatarUrl={profile?.avatarUrl ?? null}
                  userStatus={profile?.status ?? "online"}
                  isOwner={isOwner}
                  currentLanguage={locale}
                  userId={session.user.id}
                  tenantId={tenantId}
                />
                <main className="flex-1 overflow-y-auto">{children}</main>
              </div>
            </div>
          </ConfirmProvider>
        </NextIntlClientProvider>
      </TenantThemeProvider>
    </ThemeProvider>
  );
}
