"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { requireMember } from "./guards";
import { parseUserAgent, type DeviceInfo } from "./device";

export type DeviceSession = DeviceInfo & {
  id: string;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
};

/**
 * Active sessions ("devices") of the signed-in account. Sessions belong to
 * the global identity, so devices signed in to other Coledia communities
 * with the same account are listed too.
 */
export async function listMyDevices(): Promise<DeviceSession[]> {
  const { session, userId } = await requireMember();
  const rows = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, updatedAt: true },
    take: 50,
  });
  return rows.map((r) => ({
    ...parseUserAgent(r.userAgent),
    id: r.id,
    ipAddress: r.ipAddress,
    lastActiveAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    current: r.id === session.session.id,
  }));
}

/** Sign out one of the user's other devices (deletes that session). */
export async function revokeDevice(sessionId: string) {
  const { session, userId } = await requireMember();
  if (typeof sessionId !== "string" || !sessionId) throw new Error("Invalid device");
  if (sessionId === session.session.id) throw new Error("Use sign out for this device");
  await prisma.session.deleteMany({ where: { id: sessionId, userId } });
  revalidatePath("/settings/profile");
}

/** Sign out every device except the current one. */
export async function revokeOtherDevices() {
  const { session, userId } = await requireMember();
  await prisma.session.deleteMany({ where: { userId, id: { not: session.session.id } } });
  revalidatePath("/settings/profile");
}
