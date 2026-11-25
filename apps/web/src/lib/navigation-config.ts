import type { FeatureKey } from "@coledia/shared";

/**
 * Client-safe definitions of the user sidebar modules. Server logic (DB
 * merge, enforcement) lives in ./navigation.ts.
 */

export const MODULE_KEYS = ["courses", "dashboard", "news", "events", "chat", "documents"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleDef = {
  key: ModuleKey;
  labelKey: string;
  href: string;
  /** Plan feature required to use the module (hidden for members when missing). */
  feature?: FeatureKey;
  /** Dashboard is the landing page — it can be moved but not disabled. */
  canDisable: boolean;
};

/** Default order = array order. */
export const MODULES: ModuleDef[] = [
  { key: "courses", labelKey: "nav.courses", href: "/courses", canDisable: true },
  { key: "dashboard", labelKey: "nav.dashboard", href: "/dashboard", canDisable: false },
  { key: "news", labelKey: "nav.news", href: "/news", canDisable: true },
  { key: "events", labelKey: "nav.liveEvents", href: "/events", feature: "liveEvents", canDisable: true },
  { key: "chat", labelKey: "nav.chat", href: "/chat", canDisable: true },
  { key: "documents", labelKey: "nav.documents", href: "/documents", canDisable: true },
];

export function isModuleKey(key: unknown): key is ModuleKey {
  return typeof key === "string" && (MODULE_KEYS as readonly string[]).includes(key);
}

export function getModuleDef(key: ModuleKey): ModuleDef {
  return MODULES.find((m) => m.key === key)!;
}

/** A resolved navigation entry (serializable — passed to client components). */
export type NavEntry =
  | {
      kind: "module";
      key: ModuleKey;
      href: string;
      labelKey: string;
      enabled: boolean;
      canDisable: boolean;
      feature?: FeatureKey;
    }
  | {
      kind: "page";
      id: string;
      title: string;
      href: string;
      enabled: boolean;
      /** Restricted to user groups. */
      restricted: boolean;
    };

/** Stable identifier for an entry ("module:courses" / "page:<id>"). */
export function navEntryId(e: { kind: "module"; key: string } | { kind: "page"; id: string }): string {
  return e.kind === "module" ? `module:${e.key}` : `page:${e.id}`;
}
