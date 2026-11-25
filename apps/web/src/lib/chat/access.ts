import { prisma } from "@coledia/db";
import { getMyUserGroupIds, isAdminRole, requireMember } from "../guards";
import { requireModule } from "../navigation";

/**
 * Chat access rules — the single source of truth for channels and DMs.
 *
 * Rooms are addressed by key: `channel:<channelId>` or `dm:<conversationId>`.
 * - Channel: the channel's chat server belongs to this tenant, and the member is
 *   in one of the server's user groups (if any) AND one of the channel's user
 *   groups (if any). Tenant admins can access every channel (moderation).
 * - DM: the conversation belongs to this tenant and the member is one of the
 *   two participants.
 */

export type MemberCtx = Awaited<ReturnType<typeof requireMember>>;
export type RoomKind = "channel" | "dm";
export type Room = { key: string; kind: RoomKind; id: string };
export type RoomWhere = { channelId: string } | { directConversationId: string };

export function parseRoomKey(key: unknown): Room | null {
  if (typeof key !== "string") return null;
  const m = /^(channel|dm):([A-Za-z0-9_-]{1,64})$/.exec(key);
  if (!m) return null;
  return { key, kind: m[1] as RoomKind, id: m[2] };
}

export function roomKeyOf(msg: { channelId: string | null; directConversationId: string | null }): string {
  return msg.channelId ? `channel:${msg.channelId}` : `dm:${msg.directConversationId}`;
}

export function roomWhere(room: Room): RoomWhere {
  return room.kind === "channel" ? { channelId: room.id } : { directConversationId: room.id };
}

function groupsAllow(required: { id: string }[], mine: string[]) {
  return required.length === 0 || required.some((g) => mine.includes(g.id));
}

/** Returns the DM's other participant when accessible, `true` for an accessible channel, or null. */
export async function checkRoomAccess(
  ctx: MemberCtx,
  room: Room,
): Promise<{ otherUserId: string | null } | null> {
  if (room.kind === "channel") {
    const channel = await prisma.channel.findFirst({
      where: { id: room.id, chatServer: { tenantId: ctx.tenantId } },
      select: {
        userGroups: { select: { id: true } },
        chatServer: { select: { userGroups: { select: { id: true } } } },
      },
    });
    if (!channel) return null;
    if (ctx.isAdmin) return { otherUserId: null };
    const mine = await getMyUserGroupIds(ctx.userId, ctx.tenantId);
    if (!groupsAllow(channel.chatServer.userGroups, mine) || !groupsAllow(channel.userGroups, mine)) {
      return null;
    }
    return { otherUserId: null };
  }

  const conversation = await prisma.directConversation.findFirst({
    where: {
      id: room.id,
      tenantId: ctx.tenantId,
      OR: [{ user1Id: ctx.userId }, { user2Id: ctx.userId }],
    },
    select: { user1Id: true, user2Id: true },
  });
  if (!conversation) return null;
  return { otherUserId: conversation.user1Id === ctx.userId ? conversation.user2Id : conversation.user1Id };
}

/** Signed-in member + verified access to the room. Throws "Not found" otherwise. */
export async function requireRoomAccess(roomKey: unknown) {
  const ctx = await requireMember();
  await requireModule("chat", ctx);
  const room = parseRoomKey(roomKey);
  if (!room) throw new Error("Not found");
  const access = await checkRoomAccess(ctx, room);
  if (!access) throw new Error("Not found");
  return { ctx, room, otherUserId: access.otherUserId };
}

/** All room keys the member may read (for the live stream and unread counts). */
export async function accessibleRoomKeys(ctx: MemberCtx): Promise<string[]> {
  const mine = ctx.isAdmin ? [] : await getMyUserGroupIds(ctx.userId, ctx.tenantId);
  const [channels, conversations] = await Promise.all([
    prisma.channel.findMany({
      where: { chatServer: { tenantId: ctx.tenantId } },
      select: {
        id: true,
        userGroups: { select: { id: true } },
        chatServer: { select: { userGroups: { select: { id: true } } } },
      },
    }),
    prisma.directConversation.findMany({
      where: { tenantId: ctx.tenantId, OR: [{ user1Id: ctx.userId }, { user2Id: ctx.userId }] },
      select: { id: true },
    }),
  ]);
  return [
    ...channels
      .filter(
        (c) => ctx.isAdmin || (groupsAllow(c.chatServer.userGroups, mine) && groupsAllow(c.userGroups, mine)),
      )
      .map((c) => `channel:${c.id}`),
    ...conversations.map((c) => `dm:${c.id}`),
  ];
}

/** User ids that can read the room (mention targets, "seen by"). */
export async function roomMemberIds(tenantId: string, room: Room): Promise<string[]> {
  if (room.kind === "dm") {
    const c = await prisma.directConversation.findFirst({
      where: { id: room.id, tenantId },
      select: { user1Id: true, user2Id: true },
    });
    return c ? [c.user1Id, c.user2Id] : [];
  }

  const channel = await prisma.channel.findFirst({
    where: { id: room.id, chatServer: { tenantId } },
    select: {
      userGroups: { select: { id: true } },
      chatServer: { select: { userGroups: { select: { id: true } } } },
    },
  });
  if (!channel) return [];

  const memberships = await prisma.membership.findMany({
    where: { tenantId },
    select: { userId: true, role: true },
  });
  const serverGroups = channel.chatServer.userGroups.map((g) => g.id);
  const channelGroups = channel.userGroups.map((g) => g.id);
  if (serverGroups.length === 0 && channelGroups.length === 0) return memberships.map((m) => m.userId);

  const rows = await prisma.userGroupMember.findMany({
    where: { userGroup: { tenantId }, userGroupId: { in: [...serverGroups, ...channelGroups] } },
    select: { userId: true, userGroupId: true },
  });
  const groupsByUser = new Map<string, string[]>();
  for (const r of rows) groupsByUser.set(r.userId, [...(groupsByUser.get(r.userId) ?? []), r.userGroupId]);

  return memberships
    .filter((m) => {
      if (isAdminRole(m.role)) return true;
      const g = groupsByUser.get(m.userId) ?? [];
      const ok = (req: string[]) => req.length === 0 || req.some((id) => g.includes(id));
      return ok(serverGroups) && ok(channelGroups);
    })
    .map((m) => m.userId);
}
