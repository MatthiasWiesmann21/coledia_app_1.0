"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { getTenantId } from "./tenant";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getMyNotifications(limit = 20) {
  const session = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id, tenantId: getTenantId() },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCount() {
  const session = await requireUser();
  return prisma.notification.count({
    where: { userId: session.user.id, tenantId: getTenantId(), read: false },
  });
}

export async function markNotificationRead(id: string) {
  const session = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, tenantId: getTenantId() },
    data: { read: true },
  });
}

export async function markAllNotificationsRead() {
  const session = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, tenantId: getTenantId(), read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}

// ─── Preferences ───────────────────────────────────────────────

export async function getNotificationPreferences() {
  const session = await requireUser();
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
    select: { type: true, channel: true, enabled: true },
  });
  return prefs;
}

export async function setNotificationPreference(
  type: string,
  channel: string,
  enabled: boolean,
) {
  const session = await requireUser();
  await prisma.notificationPreference.upsert({
    where: {
      userId_type_channel: { userId: session.user.id, type, channel },
    },
    update: { enabled },
    create: { userId: session.user.id, type, channel, enabled },
  });
  revalidatePath("/settings/notifications");
}
