"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { osFromPlatformHint, shortcutLabel, usesMetaKey, type DeviceOS } from "@/lib/device";

const PlatformContext = createContext<DeviceOS>("other");

const noopSubscribe = () => () => {};

/** OS from User-Agent Client Hints (+ iPadOS detection), null when unknown. */
function clientHintOS(serverOS: DeviceOS): DeviceOS | null {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const hinted = osFromPlatformHint(nav.userAgentData?.platform);
  if (hinted) return hinted;
  // iPadOS reports itself as macOS — touch support gives it away
  if (serverOS === "mac" && navigator.maxTouchPoints > 1) return "ios";
  return null;
}

/**
 * Provides the current device's OS. Seeded on the server from the session's
 * user agent (correct on first paint, no hydration mismatch) and refined on
 * the client with User-Agent Client Hints when the browser supports them.
 */
export function PlatformProvider({
  initialOS,
  children,
}: {
  initialOS: DeviceOS;
  children: React.ReactNode;
}) {
  const getSnapshot = useCallback(() => clientHintOS(initialOS) ?? initialOS, [initialOS]);
  const os = useSyncExternalStore(noopSubscribe, getSnapshot, () => initialOS);
  return <PlatformContext.Provider value={os}>{children}</PlatformContext.Provider>;
}

/** The current device's OS. */
export function usePlatform(): DeviceOS {
  return useContext(PlatformContext);
}

/** Whether the platform's primary shortcut modifier is ⌘ (Apple) or Ctrl. */
export function useMetaModifier(): boolean {
  return usesMetaKey(usePlatform());
}

/** Platform-aware shortcut label: `<Shortcut keyName="k" />` → "⌘K" / "Ctrl K". */
export function Shortcut({ keyName, className }: { keyName: string; className?: string }) {
  const os = usePlatform();
  return <kbd className={className}>{shortcutLabel(os, keyName)}</kbd>;
}
