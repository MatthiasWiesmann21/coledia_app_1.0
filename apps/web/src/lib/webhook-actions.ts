"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { hasFeature } from "./plan";
import { generateWebhookSecret } from "./webhooks";
import { logAuditAsync } from "./audit";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership || membership.role !== "owner") {
    throw new Error("Only owners can manage webhooks");
  }
  if (!(await hasFeature("apiAccess"))) {
    throw new Error("Webhooks require the Organization plan");
  }
  return { session, tenantId };
}

export async function createWebhook(data: {
  url: string;
  events: string[];
  active?: boolean;
}) {
  const { tenantId } = await requireOwner();

  // Validate URL
  try {
    const u = new URL(data.url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
  } catch {
    throw new Error("Invalid URL");
  }

  const webhook = await prisma.webhook.create({
    data: {
      tenantId,
      url: data.url,
      events: data.events as any,
      secret: generateWebhookSecret(),
      active: data.active ?? true,
    },
  });

  logAuditAsync({ action: "webhook_create", entityType: "webhook", entityId: webhook.id, metadata: { url: data.url } });
  revalidatePath("/admin/settings");
  return { id: webhook.id, secret: webhook.secret };
}

export async function updateWebhook(
  id: string,
  data: { url?: string; events?: string[]; active?: boolean },
) {
  const { tenantId } = await requireOwner();

  if (data.url) {
    try {
      const u = new URL(data.url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
    } catch {
      throw new Error("Invalid URL");
    }
  }

  const webhook = await prisma.webhook.update({
    where: { id, tenantId },
    data: {
      ...(data.url ? { url: data.url } : {}),
      ...(data.events ? { events: data.events as any } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });

  logAuditAsync({ action: "webhook_update", entityType: "webhook", entityId: id });
  revalidatePath("/admin/settings");
  return { id: webhook.id };
}

export async function deleteWebhook(id: string) {
  const { tenantId } = await requireOwner();

  await prisma.webhook.delete({ where: { id, tenantId } });
  logAuditAsync({ action: "webhook_delete", entityType: "webhook", entityId: id });
  revalidatePath("/admin/settings");
}

export async function rotateWebhookSecret(id: string) {
  const { tenantId } = await requireOwner();

  const webhook = await prisma.webhook.update({
    where: { id, tenantId },
    data: { secret: generateWebhookSecret() },
  });

  logAuditAsync({ action: "webhook_update", entityType: "webhook", entityId: id, metadata: { secretRotated: true } });
  revalidatePath("/admin/settings");
  return { secret: webhook.secret };
}
