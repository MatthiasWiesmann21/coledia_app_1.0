"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { assertTenantUserGroups, requireAdminAction } from "./guards";
import { publish } from "./chat/bus";

function cleanName(name: unknown): string {
  if (typeof name !== "string") throw new Error("Name is required");
  const n = name.trim();
  if (!n) throw new Error("Name is required");
  if (n.length > 80) throw new Error("Name is too long");
  return n;
}

/** Refresh chat pages and let open chat streams re-check room access. */
function chatChanged() {
  publish("tenant", "rooms:changed", {});
  revalidatePath("/chat");
  revalidatePath("/admin/chat");
}

async function requireTenantServer(id: string, tenantId: string) {
  const server = await prisma.chatServer.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!server) throw new Error("Chat server not found");
  return server;
}

async function requireTenantChannel(id: string, tenantId: string) {
  const channel = await prisma.channel.findFirst({
    where: { id, chatServer: { tenantId } },
    select: { id: true },
  });
  if (!channel) throw new Error("Channel not found");
  return channel;
}

// ─── Chat Servers ───────────────────────────────────────────────

export async function createChatServer(name: string, userGroupIds?: string[]) {
  const { userId, tenantId } = await requireAdminAction();
  await assertTenantUserGroups(tenantId, userGroupIds);

  const server = await prisma.chatServer.create({
    data: {
      name: cleanName(name),
      tenantId,
      createdById: userId,
      userGroups: userGroupIds?.length ? { connect: userGroupIds.map((id) => ({ id })) } : undefined,
      members: { create: { userId, role: "admin" } },
    },
  });

  chatChanged();
  return server;
}

export async function updateChatServer(id: string, data: { name?: string; userGroupIds?: string[] }) {
  const { tenantId } = await requireAdminAction();
  await requireTenantServer(id, tenantId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  await prisma.chatServer.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: cleanName(data.name) } : {}),
      ...(data.userGroupIds !== undefined
        ? { userGroups: { set: data.userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
  });

  chatChanged();
}

export async function deleteChatServer(id: string) {
  const { tenantId } = await requireAdminAction();
  const { count } = await prisma.chatServer.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("Chat server not found");
  chatChanged();
}

// ─── Channels ───────────────────────────────────────────────────

export async function createChannel(chatServerId: string, name: string, userGroupIds?: string[]) {
  const { tenantId } = await requireAdminAction();
  await requireTenantServer(chatServerId, tenantId);
  await assertTenantUserGroups(tenantId, userGroupIds);

  const channel = await prisma.channel.create({
    data: {
      chatServerId,
      name: cleanName(name),
      type: "text",
      userGroups: userGroupIds?.length ? { connect: userGroupIds.map((id) => ({ id })) } : undefined,
    },
  });

  chatChanged();
  return channel;
}

export async function updateChannel(id: string, data: { name?: string; userGroupIds?: string[] }) {
  const { tenantId } = await requireAdminAction();
  await requireTenantChannel(id, tenantId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  await prisma.channel.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: cleanName(data.name) } : {}),
      ...(data.userGroupIds !== undefined
        ? { userGroups: { set: data.userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
  });

  chatChanged();
}

export async function deleteChannel(id: string) {
  const { tenantId } = await requireAdminAction();
  const { count } = await prisma.channel.deleteMany({ where: { id, chatServer: { tenantId } } });
  if (count === 0) throw new Error("Channel not found");
  chatChanged();
}

// ─── Members ────────────────────────────────────────────────────

export async function addChatServerMember(chatServerId: string, userId: string) {
  const { tenantId } = await requireAdminAction();
  await requireTenantServer(chatServerId, tenantId);
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true },
  });
  if (!membership) throw new Error("User is not a member of this community");

  await prisma.chatServerMember.upsert({
    where: { userId_chatServerId: { userId, chatServerId } },
    update: {},
    create: { userId, chatServerId, role: "member" },
  });
  revalidatePath("/chat");
}

export async function removeChatServerMember(chatServerId: string, userId: string) {
  const { tenantId } = await requireAdminAction();
  await requireTenantServer(chatServerId, tenantId);
  await prisma.chatServerMember.deleteMany({ where: { userId, chatServerId } });
  revalidatePath("/chat");
}
