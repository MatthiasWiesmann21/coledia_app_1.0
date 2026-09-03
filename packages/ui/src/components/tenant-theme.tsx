"use client";
import * as React from "react";
import {
  getPresetById,
  defaultPresetId,
  type ThemePresetColors,
} from "../theme-presets";

/**
 * Branding configuration for a tenant.
 * All fields are optional — when null, the preset defaults apply.
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

  // Theme preset + mode
  themePreset?: string | null;
  themeMode?: string | null;
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
 * Maps a ThemePresetColors object to CSS custom property key-value pairs.
 */
function colorsToVars(colors: ThemePresetColors): Record<string, string> {
  return {
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--card": colors.card,
    "--card-foreground": colors.cardForeground,
    "--muted": colors.muted,
    "--muted-foreground": colors.mutedForeground,
    "--border": colors.border,
    "--ring": colors.ring,
    "--tenant-primary": colors.tenantPrimary,
    "--tenant-nav-text": colors.tenantNavText,
    "--tenant-nav-bg": colors.tenantNavBg,
  };
}

/**
 * Injects per-tenant CSS custom properties for light + dark mode.
 *
 * 1. Looks up the theme preset (defaults to "coledia") and injects its
 *    full color palette as CSS variables for :root (light) and .dark.
 * 2. Overlays any custom color overrides from the branding fields
 *    (primaryColorLight/Dark, navTextColorLight/Dark, navBgColorLight/Dark)
 *    on top of the preset — custom values take priority.
 */
export function TenantThemeProvider({
  branding,
  children,
}: TenantThemeProviderProps) {
  const styleRef = React.useRef<HTMLStyleElement>(null);

  React.useEffect(() => {
    const preset = getPresetById(branding?.themePreset) ??
      getPresetById(defaultPresetId)!;

    // Start with preset colors
    const lightVars = colorsToVars(preset.light);
    const darkVars = colorsToVars(preset.dark);

    // Overlay custom branding overrides (non-null values take priority)
    if (branding) {
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
    }

    const lightEntries = Object.entries(lightVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
    const darkEntries = Object.entries(darkVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");

    const css = `:root { ${lightEntries} } .dark { ${darkEntries} }`;

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
