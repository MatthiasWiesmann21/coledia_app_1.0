import * as React from "react";

/**
 * Branding configuration for a tenant.
 * All fields are optional — when null, the Coledia default brand values apply.
 */
export interface TenantBranding {
  // Container settings
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  logoClickUrl?: string | null;
  faviconUrl?: string | null;

  // Design — theme / button
  primaryColorLight?: string | null;
  primaryColorDark?: string | null;

  // Design — navigation
  navTextColorLight?: string | null;
  navTextColorDark?: string | null;
  navBgColorLight?: string | null;
  navBgColorDark?: string | null;

  // Design — auth page logos
  authLogoSignUpLight?: string | null;
  authLogoSignUpDark?: string | null;
  authLogoSignInLight?: string | null;
  authLogoSignInDark?: string | null;
  authLogoForgotLight?: string | null;
  authLogoForgotDark?: string | null;
}

interface TenantThemeContextValue {
  branding: TenantBranding | null;
}

const TenantThemeContext = React.createContext<TenantThemeContextValue>({
  branding: null,
});

export function useTenantBranding() {
  return React.useContext(TenantThemeContext);
}

interface TenantThemeProviderProps {
  branding: TenantBranding | null;
  children: React.ReactNode;
}

/**
 * Injects per-tenant CSS custom properties for light + dark mode.
 * Powers the old Clubyte "Design Settings" + "Container Settings".
 *
 * In light mode: --tenant-primary, --tenant-nav-text, --tenant-nav-bg
 *   are set from the *Light branding fields.
 * In dark mode (.dark class): they're overridden from the *Dark fields.
 *
 * When a field is null, the default from globals.css applies.
 */
export function TenantThemeProvider({
  branding,
  children,
}: TenantThemeProviderProps) {
  const styleRef = React.useRef<HTMLStyleElement>(null);

  React.useEffect(() => {
    if (!branding) return;

    const lightVars: Record<string, string> = {};
    const darkVars: Record<string, string> = {};

    if (branding.primaryColorLight)
      lightVars["--tenant-primary"] = branding.primaryColorLight;
    if (branding.primaryColorDark)
      darkVars["--tenant-primary"] = branding.primaryColorDark;
    if (branding.navTextColorLight)
      lightVars["--tenant-nav-text"] = branding.navTextColorLight;
    if (branding.navTextColorDark)
      darkVars["--tenant-nav-text"] = branding.navTextColorDark;
    if (branding.navBgColorLight)
      lightVars["--tenant-nav-bg"] = branding.navBgColorLight;
    if (branding.navBgColorDark)
      darkVars["--tenant-nav-bg"] = branding.navBgColorDark;

    const lightEntries = Object.entries(lightVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
    const darkEntries = Object.entries(darkVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");

    const css = `
      :root { ${lightEntries} }
      .dark { ${darkEntries} }
    `;

    let styleEl = styleRef.current;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-tenant-theme", "true");
      document.head.appendChild(styleEl);
      styleRef.current = styleEl;
    }
    styleEl.textContent = css;

    return () => {
      styleEl?.remove();
      styleRef.current = null;
    };
  }, [branding]);

  return (
    <TenantThemeContext.Provider value={{ branding }}>
      {children}
    </TenantThemeContext.Provider>
  );
}

/**
 * Resolves the correct logo URL based on the current theme (light/dark)
 * and the page context (app nav vs. auth pages).
 */
export function resolveLogo(
  branding: TenantBranding | null,
  theme: "light" | "dark",
  page: "app" | "signup" | "signin" | "forgot",
): string | null {
  if (!branding) return null;

  const isDark = theme === "dark";

  switch (page) {
    case "signup":
      return (isDark ? branding.authLogoSignUpDark : branding.authLogoSignUpLight) ?? null;
    case "signin":
      return (isDark ? branding.authLogoSignInDark : branding.authLogoSignInLight) ?? null;
    case "forgot":
      return (isDark ? branding.authLogoForgotDark : branding.authLogoForgotLight) ?? null;
    case "app":
    default:
      return (isDark ? branding.logoDarkUrl : branding.logoLightUrl) ?? null;
  }
}
