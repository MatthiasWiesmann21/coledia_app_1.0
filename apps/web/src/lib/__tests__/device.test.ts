import { describe, it, expect } from "vitest";
import { osFromPlatformHint, parseUserAgent, shortcutLabel } from "@/lib/device";

const UA = {
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  winEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  linuxChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  chromebook:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("parseUserAgent", () => {
  it.each([
    [UA.macChrome, "mac", "Chrome", "desktop"],
    [UA.macSafari, "mac", "Safari", "desktop"],
    [UA.winEdge, "windows", "Edge", "desktop"],
    [UA.winFirefox, "windows", "Firefox", "desktop"],
    [UA.linuxChrome, "linux", "Chrome", "desktop"],
    [UA.iphone, "ios", "Safari", "mobile"],
    [UA.androidPhone, "android", "Chrome", "mobile"],
    [UA.androidTablet, "android", "Chrome", "tablet"],
    [UA.chromebook, "chromeos", "Chrome", "desktop"],
  ])("%s", (ua, os, browser, deviceType) => {
    expect(parseUserAgent(ua)).toMatchObject({ os, browser, deviceType });
  });

  it("handles missing user agents", () => {
    expect(parseUserAgent(null)).toMatchObject({ os: "other", deviceType: "desktop" });
  });
});

describe("shortcuts", () => {
  it("uses ⌘ on Apple platforms and Ctrl elsewhere", () => {
    expect(shortcutLabel("mac", "k")).toBe("⌘K");
    expect(shortcutLabel("ios", "k")).toBe("⌘K");
    expect(shortcutLabel("windows", "k")).toBe("Ctrl K");
    expect(shortcutLabel("linux", "k")).toBe("Ctrl K");
  });

  it("maps client-hint platforms", () => {
    expect(osFromPlatformHint("macOS")).toBe("mac");
    expect(osFromPlatformHint("Windows")).toBe("windows");
    expect(osFromPlatformHint("Linux")).toBe("linux");
    expect(osFromPlatformHint("Chrome OS")).toBe("chromeos");
    expect(osFromPlatformHint("")).toBeNull();
  });
});
