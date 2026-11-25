import { cache } from "react";
import { prisma } from "@coledia/db";
import { getTenantId } from "./tenant";
import { getPlanFeatureMap } from "./plan";
import { getMyUserGroupIds } from "./guards";
import {
  MODULES,
  isModuleKey,
  type ModuleKey,
  type NavEntry,
} from "./navigation-config";

export { MODULES, isModuleKey, type ModuleKey, type NavEntry } from "./navigation-config";

/**
 * User sidebar navigation: order + enabled state of modules and custom pages.
 *
 * NavigationItem rows only exist once an admin saved Settings → Navigation.
 * Everything without a row falls back to the code defaults: modules in
 * MODULES order, published custom pages appended (enabled). Disabled modules
 * are hidden AND blocked for members (pages, server actions, APIs) — admins
 * keep access so they can manage/prepare content.
 */

type NavRow = {
  kind: string;
  moduleKey: string | null;
  customPageId: string | null;
  position: number;
  enabled: boolean;
};

type NavPage = {
  id: string;
  title: string;
  slug: string;
  createdAt: Date;
  userGroups: { id: string }[];
};

export type ResolvedNavEntry = NavEntry & { groupIds?: string[] };

/** Merge stored rows with defaults (pure — exported for tests). */
export function mergeNavigation(rows: NavRow[], pages: NavPage[]): ResolvedNavEntry[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const pagesById = new Map(pages.map((p) => [p.id, p]));
  const out: ResolvedNavEntry[] = [];
  const seenModules = new Set<ModuleKey>();
  const seenPages = new Set<string>();

  const moduleEntry = (key: ModuleKey, enabled: boolean): ResolvedNavEntry => {
    const def = MODULES.find((m) => m.key === key)!;
    return {
      kind: "module",
      key,
      href: def.href,
      labelKey: def.labelKey,
      enabled: def.canDisable ? enabled : true,
      canDisable: def.canDisable,
      ...(def.feature ? { feature: def.feature } : {}),
    };
  };
  const pageEntry = (p: NavPage, enabled: boolean): ResolvedNavEntry => ({
    kind: "page",
    id: p.id,
    title: p.title,
    href: `/p/${p.slug}`,
    enabled,
    restricted: p.userGroups.length > 0,
    groupIds: p.userGroups.map((g) => g.id),
  });

  for (const row of sorted) {
    if (row.kind === "module" && isModuleKey(row.moduleKey) && !seenModules.has(row.moduleKey)) {
      seenModules.add(row.moduleKey);
      out.push(moduleEntry(row.moduleKey, row.enabled));
    } else if (row.kind === "page" && row.customPageId) {
      const page = pagesById.get(row.customPageId);
      // Unpublished / deleted pages drop out of the navigation
      if (page && !seenPages.has(page.id)) {
        seenPages.add(page.id);
        out.push(pageEntry(page, row.enabled));
      }
    }
  }

  // New modules (or no saved config): append in default order
  for (const def of MODULES) {
    if (!seenModules.has(def.key)) out.push(moduleEntry(def.key, true));
  }
  // Newly published pages are added automatically at the end
  for (const p of [...pages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (!seenPages.has(p.id)) out.push(pageEntry(p, true));
  }
  return out;
}

/** Full navigation for the current tenant (incl. disabled entries). */
export const getNavigationEntries = cache(async (): Promise<ResolvedNavEntry[]> => {
  const tenantId = getTenantId();
  const [rows, pages] = await Promise.all([
    prisma.navigationItem.findMany({
      where: { tenantId },
      select: { kind: true, moduleKey: true, customPageId: true, position: true, enabled: true },
    }),
    prisma.customPage.findMany({
      where: { tenantId, published: true },
      select: { id: true, title: true, slug: true, createdAt: true, userGroups: { select: { id: true } } },
    }),
  ]);
  return mergeNavigation(rows ?? [], pages ?? []);
});

/**
 * Sidebar entries for the signed-in user: enabled only, plan features
 * respected, group-restricted pages only for members of those groups.
 */
export async function getUserNavigation(ctx: {
  userId: string;
  tenantId: string;
  isAdmin: boolean;
}): Promise<NavEntry[]> {
  const [entries, features] = await Promise.all([getNavigationEntries(), getPlanFeatureMap()]);
  const needsGroups = !ctx.isAdmin && entries.some((e) => e.kind === "page" && e.restricted);
  const myGroups = needsGroups ? await getMyUserGroupIds(ctx.userId, ctx.tenantId) : [];

  return entries
    .filter((e) => {
      if (!e.enabled) return false;
      if (e.kind === "module") return !e.feature || features[e.feature];
      if (!features.customPages) return false;
      return ctx.isAdmin || !e.restricted || (e.groupIds ?? []).some((g) => myGroups.includes(g));
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ groupIds, ...e }) => e as NavEntry);
}

/** Enabled state of every module for a tenant (cached per request). */
export const getModuleStates = cache(
  async (tenantId: string): Promise<Record<ModuleKey, boolean>> => {
    const rows =
      (await prisma.navigationItem.findMany({
        where: { tenantId, kind: "module" },
        select: { moduleKey: true, enabled: true },
      })) ?? [];
    const states = Object.fromEntries(MODULES.map((m) => [m.key, true])) as Record<ModuleKey, boolean>;
    for (const r of rows) {
      const def = MODULES.find((m) => m.key === r.moduleKey);
      if (def?.canDisable) states[def.key] = r.enabled;
    }
    return states;
  },
);

/** Whether a module is enabled for members of the tenant. */
export async function isModuleEnabled(
  key: ModuleKey,
  tenantId: string = getTenantId(),
): Promise<boolean> {
  return (await getModuleStates(tenantId))[key];
}

/**
 * Block member access to a disabled module. Admins always pass (they manage
 * content of disabled modules). Throws "Module disabled".
 */
export async function requireModule(
  key: ModuleKey,
  ctx: { isAdmin: boolean; tenantId?: string },
): Promise<void> {
  if (ctx.isAdmin) return;
  if (!(await isModuleEnabled(key, ctx.tenantId))) throw new Error("Module disabled");
}
