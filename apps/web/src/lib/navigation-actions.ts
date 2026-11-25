"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { logAuditAsync } from "./audit";
import { requireAdminAction } from "./guards";
import { MODULES, isModuleKey, type ModuleKey } from "./navigation-config";

export type NavigationInput = (
  | { kind: "module"; key: string; enabled: boolean }
  | { kind: "page"; id: string; enabled: boolean }
)[];

const MAX_ITEMS = 200;

/**
 * Save the user sidebar (Settings → Navigation): order = array order.
 * Module keys must be known; page ids must belong to this tenant. The
 * Dashboard can't be disabled. Replaces the tenant's rows in one transaction.
 */
export async function saveNavigation(items: NavigationInput) {
  const { tenantId } = await requireAdminAction();
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new Error("Invalid navigation");

  const seen = new Set<string>();
  const modules: { key: ModuleKey; enabled: boolean; position: number }[] = [];
  const pages: { id: string; enabled: boolean; position: number }[] = [];

  items.forEach((item, position) => {
    if (!item || typeof item.enabled !== "boolean") throw new Error("Invalid navigation");
    if (item.kind === "module") {
      if (!isModuleKey(item.key)) throw new Error("Unknown module");
      const def = MODULES.find((m) => m.key === item.key)!;
      if (seen.has(`m:${item.key}`)) throw new Error("Duplicate entry");
      seen.add(`m:${item.key}`);
      modules.push({ key: item.key, enabled: def.canDisable ? item.enabled : true, position });
    } else if (item.kind === "page") {
      if (typeof item.id !== "string" || !item.id) throw new Error("Invalid page");
      if (seen.has(`p:${item.id}`)) throw new Error("Duplicate entry");
      seen.add(`p:${item.id}`);
      pages.push({ id: item.id, enabled: item.enabled, position });
    } else {
      throw new Error("Invalid navigation");
    }
  });

  if (pages.length) {
    const count = await prisma.customPage.count({
      where: { id: { in: pages.map((p) => p.id) }, tenantId },
    });
    if (count !== pages.length) throw new Error("Invalid page");
  }

  await prisma.$transaction([
    prisma.navigationItem.deleteMany({ where: { tenantId } }),
    prisma.navigationItem.createMany({
      data: [
        ...modules.map((m) => ({
          tenantId,
          kind: "module",
          moduleKey: m.key,
          position: m.position,
          enabled: m.enabled,
        })),
        ...pages.map((p) => ({
          tenantId,
          kind: "page",
          customPageId: p.id,
          position: p.position,
          enabled: p.enabled,
        })),
      ],
    }),
  ]);

  logAuditAsync({
    action: "settings_change",
    entityType: "navigation",
    entityId: tenantId,
    metadata: { disabled: [...modules, ...pages].filter((i) => !i.enabled).length },
  });
  revalidatePath("/", "layout");
}
