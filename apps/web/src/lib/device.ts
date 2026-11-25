/**
 * Dependency-free user-agent parsing (client + server safe).
 *
 * Used for platform-aware UI (⌘K vs Ctrl K) and the "Active devices" list.
 * Better-Auth stores the user agent per session, so every device a user
 * signs in on is tracked independently and refreshed on each sign-in.
 */

export type DeviceOS = "mac" | "windows" | "linux" | "ios" | "android" | "chromeos" | "other";
export type DeviceType = "desktop" | "mobile" | "tablet";

export type DeviceInfo = {
  os: DeviceOS;
  osLabel: string;
  browser: string;
  deviceType: DeviceType;
};

const OS_LABELS: Record<DeviceOS, string> = {
  mac: "macOS",
  windows: "Windows",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
  chromeos: "ChromeOS",
  other: "Unknown OS",
};

export function detectOS(ua: string): DeviceOS {
  const s = ua.toLowerCase();
  // Order matters: iPadOS 13+ reports "Macintosh" — callers on the client can
  // refine with touch support; on the server we keep "mac".
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  if (s.includes("android")) return "android";
  if (s.includes("cros")) return "chromeos";
  if (s.includes("windows")) return "windows";
  if (s.includes("mac os x") || s.includes("macintosh")) return "mac";
  if (s.includes("linux") || s.includes("x11")) return "linux";
  return "other";
}

export function detectBrowser(ua: string): string {
  if (/edg(e|a|ios)?\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios|chromium/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Unknown browser";
}

export function detectDeviceType(ua: string): DeviceType {
  if (/ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const os = detectOS(s);
  return { os, osLabel: OS_LABELS[os], browser: detectBrowser(s), deviceType: detectDeviceType(s) };
}

/** Map navigator.userAgentData.platform (client hints) to our OS ids. */
export function osFromPlatformHint(platform: string | null | undefined): DeviceOS | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes("mac")) return "mac";
  if (p.includes("win")) return "windows";
  if (p.includes("android")) return "android";
  if (p.includes("ios")) return "ios";
  if (p.includes("chrome")) return "chromeos";
  if (p.includes("linux")) return "linux";
  return null;
}

/** Apple platforms use ⌘ as the primary modifier; everything else Ctrl. */
export function usesMetaKey(os: DeviceOS): boolean {
  return os === "mac" || os === "ios";
}

/** Label for a "mod+<key>" shortcut, e.g. "⌘K" or "Ctrl K". */
export function shortcutLabel(os: DeviceOS, key: string): string {
  const k = key.toUpperCase();
  return usesMetaKey(os) ? `⌘${k}` : `Ctrl ${k}`;
}
