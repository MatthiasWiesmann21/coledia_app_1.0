/**
 * Theme presets for tenant branding.
 * Each preset defines a full color palette for both light and dark mode.
 * The owner picks a preset as a starting point, then can override individual
 * colors via the Branding model fields.
 */

export interface ThemePresetColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  tenantPrimary: string;
  tenantNavText: string;
  tenantNavBg: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Swatch colors for preview cards */
  swatch: { primary: string; accent: string; bg: string };
  light: ThemePresetColors;
  dark: ThemePresetColors;
}

export const themePresets: ThemePreset[] = [
  {
    id: "coledia",
    name: "Coledia",
    description: "Navy + Teal — the default Coledia brand",
    swatch: { primary: "#008080", accent: "#1f78b4", bg: "#081830" },
    light: {
      background: "#f4f6f8",
      foreground: "#0c2340",
      card: "#ffffff",
      cardForeground: "#0c2340",
      muted: "#e8edf2",
      mutedForeground: "#555555",
      border: "#dde5ec",
      ring: "#008080",
      tenantPrimary: "#008080",
      tenantNavText: "#0c2340",
      tenantNavBg: "#ffffff",
    },
    dark: {
      background: "#081830",
      foreground: "#f4f6f8",
      card: "#0e2542",
      cardForeground: "#f4f6f8",
      muted: "#122a47",
      mutedForeground: "#9aa9bd",
      border: "#1d3a5c",
      ring: "#2aa99b",
      tenantPrimary: "#2aa99b",
      tenantNavText: "#f4f6f8",
      tenantNavBg: "#0e2542",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep blue + cyan — fresh and professional",
    swatch: { primary: "#0284c7", accent: "#06b6d4", bg: "#0c1e3a" },
    light: {
      background: "#f0f7ff",
      foreground: "#0c1e3a",
      card: "#ffffff",
      cardForeground: "#0c1e3a",
      muted: "#e0ecf7",
      mutedForeground: "#475569",
      border: "#cbd5e1",
      ring: "#0284c7",
      tenantPrimary: "#0284c7",
      tenantNavText: "#0c1e3a",
      tenantNavBg: "#ffffff",
    },
    dark: {
      background: "#0c1e3a",
      foreground: "#e0ecf7",
      card: "#163056",
      cardForeground: "#e0ecf7",
      muted: "#1e3a64",
      mutedForeground: "#94a8c4",
      border: "#2a4a78",
      ring: "#06b6d4",
      tenantPrimary: "#06b6d4",
      tenantNavText: "#e0ecf7",
      tenantNavBg: "#163056",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Dark green + lime — natural and calm",
    swatch: { primary: "#16a34a", accent: "#84cc16", bg: "#0a1f14" },
    light: {
      background: "#f0faf0",
      foreground: "#0a1f14",
      card: "#ffffff",
      cardForeground: "#0a1f14",
      muted: "#e0f0e0",
      mutedForeground: "#4b5563",
      border: "#c8d8c8",
      ring: "#16a34a",
      tenantPrimary: "#16a34a",
      tenantNavText: "#0a1f14",
      tenantNavBg: "#ffffff",
    },
    dark: {
      background: "#0a1f14",
      foreground: "#e0f0e0",
      card: "#143020",
      cardForeground: "#e0f0e0",
      muted: "#1c3a28",
      mutedForeground: "#8fa898",
      border: "#2a4d38",
      ring: "#84cc16",
      tenantPrimary: "#84cc16",
      tenantNavText: "#e0f0e0",
      tenantNavBg: "#143020",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep purple + violet — elegant and modern",
    swatch: { primary: "#7c3aed", accent: "#a855f7", bg: "#0f0a1f" },
    light: {
      background: "#f8f5ff",
      foreground: "#0f0a1f",
      card: "#ffffff",
      cardForeground: "#0f0a1f",
      muted: "#ece5f7",
      mutedForeground: "#4b4563",
      border: "#d4c8e8",
      ring: "#7c3aed",
      tenantPrimary: "#7c3aed",
      tenantNavText: "#0f0a1f",
      tenantNavBg: "#ffffff",
    },
    dark: {
      background: "#0f0a1f",
      foreground: "#ece5f7",
      card: "#1c1438",
      cardForeground: "#ece5f7",
      muted: "#281d4a",
      mutedForeground: "#9c8fb8",
      border: "#3a2d60",
      ring: "#a855f7",
      tenantPrimary: "#a855f7",
      tenantNavText: "#ece5f7",
      tenantNavBg: "#1c1438",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm orange + amber — energetic and bold",
    swatch: { primary: "#ea580c", accent: "#f59e0b", bg: "#1f1208" },
    light: {
      background: "#fff8f0",
      foreground: "#1f1208",
      card: "#ffffff",
      cardForeground: "#1f1208",
      muted: "#f7ebe0",
      mutedForeground: "#6b5238",
      border: "#e8d4c0",
      ring: "#ea580c",
      tenantPrimary: "#ea580c",
      tenantNavText: "#1f1208",
      tenantNavBg: "#ffffff",
    },
    dark: {
      background: "#1f1208",
      foreground: "#f7ebe0",
      card: "#33200f",
      cardForeground: "#f7ebe0",
      muted: "#4a2e18",
      mutedForeground: "#b89878",
      border: "#5e4028",
      ring: "#f59e0b",
      tenantPrimary: "#f59e0b",
      tenantNavText: "#f7ebe0",
      tenantNavBg: "#33200f",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Pink + rose — soft and friendly",
    swatch: { primary: "#e11d48", accent: "#fb7185", bg: "#1f0a12" },
    light: {
      background: "#fff0f4",
      foreground: "#1f0a12",
      card: "#ffffff",
      cardForeground: "#1f0a12",
      muted: "#f7e0e8",
      mutedForeground: "#6b3848",
      border: "#e8c0d0",
      ring: "#e11d48",
      tenantPrimary: "#e11d48",
      tenantNavText: "#1f0a12",
      tenantNavBg: "#ffffff",
    },
    dark: {
      background: "#1f0a12",
      foreground: "#f7e0e8",
      card: "#381420",
      cardForeground: "#f7e0e8",
      muted: "#4a1e30",
      mutedForeground: "#b87890",
      border: "#602848",
      ring: "#fb7185",
      tenantPrimary: "#fb7185",
      tenantNavText: "#f7e0e8",
      tenantNavBg: "#381420",
    },
  },
];

const presetMap = new Map(themePresets.map((p) => [p.id, p]));

export function getPresetById(id: string | null | undefined): ThemePreset | null {
  if (!id) return null;
  return presetMap.get(id) ?? null;
}

export const defaultPresetId = "coledia";
export const validPresetIds = themePresets.map((p) => p.id);
