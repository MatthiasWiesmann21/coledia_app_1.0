"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: session.user.id,
        tenantId: getTenantId(),
      },
    },
  });

  if (
    !membership ||
    !["owner", "admin", "operator"].includes(membership.role)
  ) {
    throw new Error("Forbidden");
  }

  return { session, tenantId: getTenantId() };
}

// ─── Chat Servers ───────────────────────────────────────────────

export async function createChatServer(name: string, userGroupIds?: string[]) {
  const { session, tenantId } = await requireAdmin();

  const server = await prisma.chatServer.create({
    data: {
      name,
      tenantId,
      createdById: session.user.id,
      userGroups: userGroupIds?.length
        ? { connect: userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  // Add creator as admin member
  await prisma.chatServerMember.create({
    data: {
      userId: session.user.id,
      chatServerId: server.id,
      role: "admin",
    },
  });

  revalidatePath("/chat");
  revalidatePath("/admin/chat");
  return server;
}

export async function updateChatServer(id: string, data: { name?: string; userGroupIds?: string[] }) {
  await requireAdmin();

  const { userGroupIds, ...rest } = data;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  await prisma.chatServer.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/chat");
  revalidatePath("/admin/chat");
}

export async function deleteChatServer(id: string) {
  await requireAdmin();

  await prisma.chatServer.delete({ where: { id } });

  revalidatePath("/chat");
  revalidatePath("/admin/chat");
}

// ─── Channels ───────────────────────────────────────────────────

export async function createChannel(
  chatServerId: string,
  name: string,
  userGroupIds?: string[],
) {
  await requireAdmin();

  const channel = await prisma.channel.create({
    data: {
      chatServerId,
      name,
      type: "text",
      userGroups: userGroupIds?.length
        ? { connect: userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidatePath("/chat");
  revalidatePath("/admin/chat");
  return channel;
}

export async function updateChannel(
  id: string,
  data: { name?: string; userGroupIds?: string[] },
) {
  await requireAdmin();

  const { userGroupIds, ...rest } = data;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  await prisma.channel.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/chat");
  revalidatePath("/admin/chat");
}

export async function deleteChannel(id: string) {
  await requireAdmin();

  await prisma.channel.delete({ where: { id } });

  revalidatePath("/chat");
  revalidatePath("/admin/chat");
}

// ─── Members ────────────────────────────────────────────────────

export async function addChatServerMember(chatServerId: string, userId: string) {
  await requireAdmin();

  await prisma.chatServerMember.create({
    data: { userId, chatServerId, role: "member" },
  });

  revalidatePath("/chat");
}

export async function removeChatServerMember(
  chatServerId: string,
  userId: string,
) {
  await requireAdmin();

  await prisma.chatServerMember.delete({
    where: {
      userId_chatServerId: { userId, chatServerId },
    },
  });

  revalidatePath("/chat");
}

// ─── Direct Messages ────────────────────────────────────────────

export async function getOrCreateDM(otherUserId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();
  const userId = session.user.id;

  const [user1Id, user2Id] =
    userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  const conversation = await prisma.directConversation.upsert({
    where: {
      user1Id_user2Id: { user1Id, user2Id },
    },
    update: {},
    create: { tenantId, user1Id, user2Id },
  });

  return conversation;
}
