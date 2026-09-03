import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "../globals.css";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { ThemeProvider } from "@/components/theme-provider";
import { TenantThemeProvider, type TenantBranding } from "@coledia/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Coledia — Sign In",
  description: "Sign in to your Coledia community platform",
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages(defaultLocale);

  // Fetch tenant branding to apply the correct theme on auth pages
  let branding: TenantBranding | null = null;
  let themeMode = "dark";
  try {
    const tenantId = getTenantId();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (tenant?.branding) {
      branding = {
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
      };
      themeMode = tenant.branding.themeMode ?? "dark";
    }
  } catch {
    // Ignore — fall back to defaults
  }

  return (
    <ThemeProvider defaultTheme={themeMode}>
      <TenantThemeProvider branding={branding}>
        <NextIntlClientProvider locale={defaultLocale} messages={messages}>
          <div className={`${inter.variable} min-h-screen`}>
            <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
              {/* Theme toggle — top-right corner */}
              <div className="absolute right-4 top-4">
                <ThemeToggle />
              </div>

              {/* Custom logo placeholder */}
              {/* In production this will be replaced with the tenant's custom logo
                  via TenantBranding (authLogoSignInLight / authLogoSignInDark). */}
              <a
                href="/"
                className="mb-8 flex items-center justify-center"
                aria-label="Home"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                  <span className="text-2xl font-bold text-brand-gradient">C</span>
                </div>
              </a>

              {/* Auth card */}
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
                {children}
              </div>

              {/* Footer */}
              <p className="mt-8 text-sm text-muted-foreground">
                Made by{" "}
                <a
                  href="https://coledia.com"
                  className="font-medium text-(--tenant-primary) hover:underline"
                >
                  Coledia
                </a>
              </p>
            </div>
          </div>
        </NextIntlClientProvider>
      </TenantThemeProvider>
    </ThemeProvider>
  );
}
