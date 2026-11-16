"use server";

import fs from "fs/promises";
import { prisma } from "@coledia/db";
import { requireMember } from "./guards";
import { notify } from "./notifications";
import { logAuditAsync } from "./audit";
import { deleteFile, resolveStoragePath } from "./storage";
import { publish } from "./chat/bus";
import {
  accessibleRoomKeys,
  checkRoomAccess,
  parseRoomKey,
  requireRoomAccess,
  roomKeyOf,
  roomMemberIds,
  roomWhere,
  type MemberCtx,
  type Room,
} from "./chat/access";
import {
  displayName,
  extractMentionIds,
  groupReactions,
  messageInclude,
  storedAttachments,
  toMessageDTO,
  type MessageDTO,
  type ReactionGroup,
  type ReadStateDTO,
  type StoredAttachment,
} from "./chat/serialize";

const MAX_LENGTH = 4000;
const PAGE_SIZE = 50;
const MAX_ATTACHMENTS = 10;

// ─── Helpers ────────────────────────────────────────────────────

function cleanContent(content: unknown): string {
  if (typeof content !== "string") throw new Error("Invalid message");
  const text = content.replace(/\r\n/g, "\n").trim();
  if (text.length > MAX_LENGTH) throw new Error(`Messages can be at most ${MAX_LENGTH} characters`);
  return text;
}

// Simple per-user flood protection (single process per tenant container)
const sendLog = new Map<string, number[]>();
function assertRateLimit(userId: string) {
  const now = Date.now();
  const recent = (sendLog.get(userId) ?? []).filter((t) => now - t < 10_000);
  if (recent.length >= 20) throw new Error("You are sending messages too quickly");
  recent.push(now);
  sendLog.set(userId, recent);
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, displayName(u)]));
}

function mentionList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

async function loadDTO(messageId: string, ctx: MemberCtx): Promise<MessageDTO> {
  const m = await prisma.message.findFirstOrThrow({
    where: { id: messageId, tenantId: ctx.tenantId },
    include: messageInclude(ctx.tenantId),
  });
  return toMessageDTO(m, ctx.userId, await namesFor(mentionList(m.mentions)));
}

/** Load a message of this tenant and verify the caller can access its room. */
async function requireMessage(messageId: unknown) {
  if (typeof messageId !== "string") throw new Error("Not found");
  const ctx = await requireMember();
  const message = await prisma.message.findFirst({
    where: { id: messageId, tenantId: ctx.tenantId },
    select: {
      id: true,
      userId: true,
      channelId: true,
      directConversationId: true,
      deletedAt: true,
      attachments: true,
    },
  });
  if (!message) throw new Error("Not found");
  const room = parseRoomKey(roomKeyOf(message));
  if (!room || !(await checkRoomAccess(ctx, room))) throw new Error("Not found");
  return { ctx, message, room };
}

/** A single emoji grapheme (incl. ZWJ sequences, skin tones and flags). */
function isValidEmoji(emoji: unknown): emoji is string {
  if (typeof emoji !== "string" || emoji.length === 0 || emoji.length > 16 || /\s/.test(emoji)) return false;
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji)];
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji);
}

/** Validate attachments this user uploaded via /api/chat/attachments. */
async function cleanAttachments(input: unknown, ctx: MemberCtx): Promise<StoredAttachment[]> {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_ATTACHMENTS) throw new Error("Invalid attachments");
  // Upload paths embed the uploader id, so nobody can attach someone else's file
  const ownPath = new RegExp(`^${ctx.tenantId}/chat/\\d+-[0-9a-f]{8}-${ctx.userId}-[^/\\\\]+$`);
  const result: StoredAttachment[] = [];
  for (const a of input as Partial<StoredAttachment>[]) {
    if (
      typeof a?.storagePath !== "string" ||
      !ownPath.test(a.storagePath) ||
      a.storagePath.includes("..") ||
      typeof a.name !== "string" ||
      typeof a.mimeType !== "string" ||
      typeof a.size !== "number"
    ) {
      throw new Error("Invalid attachment");
    }
    try {
      await fs.access(resolveStoragePath(a.storagePath));
    } catch {
      throw new Error("Attachment upload expired — please attach the file again");
    }
    result.push({ name: a.name.slice(0, 255), mimeType: a.mimeType, size: a.size, storagePath: a.storagePath });
  }
  return result;
}

/** Mentions restricted to people who can read the room (and never yourself). */
async function allowedMentions(ctx: MemberCtx, room: Room, content: string): Promise<string[]> {
  const requested = extractMentionIds(content).filter((id) => id !== ctx.userId);
  if (requested.length === 0) return [];
  const allowed = new Set(await roomMemberIds(ctx.tenantId, room));
  return requested.filter((id) => allowed.has(id));
}

async function upsertReadState(ctx: MemberCtx, room: Room, at: Date): Promise<void> {
  const unique =
    room.kind === "channel"
      ? { userId_channelId: { userId: ctx.userId, channelId: room.id } }
      : { userId_directConversationId: { userId: ctx.userId, directConversationId: room.id } };
  const existing = await prisma.chatReadState.findUnique({ where: unique, select: { lastReadAt: true } });
  // Monotonic — never move the read position backwards
  if (existing && existing.lastReadAt >= at) return;
  await prisma.chatReadState.upsert({
    where: unique,
    update: { lastReadAt: at },
    create: { tenantId: ctx.tenantId, userId: ctx.userId, ...roomWhere(room), lastReadAt: at },
  });
  publish(room.key, "read:updated", { room: room.key, userId: ctx.userId, lastReadAt: at.toISOString() });
}

// ─── Reading ────────────────────────────────────────────────────

/**
 * A page of messages (oldest → newest). Without `before` returns the latest
 * page; with `before` (a message id) returns the page preceding it.
 */
export async function getMessages(
  roomKey: string,
  opts?: { before?: string },
): Promise<{ messages: MessageDTO[]; hasMore: boolean; readStates: ReadStateDTO[] }> {
  const { ctx, room } = await requireRoomAccess(roomKey);
  const where = { tenantId: ctx.tenantId, ...roomWhere(room) };

  let cursor: { id: string; createdAt: Date } | null = null;
  if (opts?.before) {
    cursor = await prisma.message.findFirst({
      where: { ...where, id: opts.before },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new Error("Not found");
  }

  const rows = await prisma.message.findMany({
    where: cursor
      ? {
          ...where,
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : where,
    include: messageInclude(ctx.tenantId),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE).reverse();
  const names = await namesFor([...new Set(page.flatMap((m) => mentionList(m.mentions)))]);

  const readStates = await prisma.chatReadState.findMany({
    where: { tenantId: ctx.tenantId, ...roomWhere(room) },
    select: { userId: true, lastReadAt: true },
  });

  return {
    messages: page.map((m) => toMessageDTO(m, ctx.userId, names)),
    hasMore,
    readStates: readStates.map((r) => ({ userId: r.userId, lastReadAt: r.lastReadAt.toISOString() })),
  };
}

/** Unread message counts per accessible room (rooms without unread are omitted). */
export async function getUnreadCounts(): Promise<Record<string, number>> {
  const ctx = await requireMember();
  const keys = await accessibleRoomKeys(ctx);
  const states = await prisma.chatReadState.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { channelId: true, directConversationId: true, lastReadAt: true },
  });
  const lastRead = new Map(
    states.map((s) => [s.channelId ? `channel:${s.channelId}` : `dm:${s.directConversationId}`, s.lastReadAt]),
  );

  const entries = await Promise.all(
    keys.map(async (key) => {
      const room = parseRoomKey(key)!;
      const since = lastRead.get(key);
      const count = await prisma.message.count({
        where: {
          tenantId: ctx.tenantId,
          ...roomWhere(room),
          userId: { not: ctx.userId },
          deletedAt: null,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
      });
      return [key, count] as const;
    }),
  );
  return Object.fromEntries(entries.filter(([, c]) => c > 0));
}

// ─── Writing ────────────────────────────────────────────────────

export async function sendMessage(
  roomKey: string,
  input: { content: string; replyToId?: string | null; attachments?: StoredAttachment[] },
): Promise<MessageDTO> {
  const { ctx, room, otherUserId } = await requireRoomAccess(roomKey);
  assertRateLimit(ctx.userId);

  const content = cleanContent(input.content);
  const attachments = await cleanAttachments(input.attachments, ctx);
  if (!content && attachments.length === 0) throw new Error("Message is empty");

  // DMs only between current members of this tenant
  if (otherUserId) {
    const other = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: otherUserId, tenantId: ctx.tenantId } },
      select: { id: true },
    });
    if (!other) throw new Error("This member is no longer part of the community");
  }

  let replyToId: string | null = null;
  if (input.replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: input.replyToId, tenantId: ctx.tenantId, ...roomWhere(room), deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new Error("The message you replied to is no longer available");
    replyToId = target.id;
  }

  const mentions = await allowedMentions(ctx, room, content);

  const message = await prisma.message.create({
    data: {
      tenantId: ctx.tenantId,
      ...roomWhere(room),
      userId: ctx.userId,
      content,
      replyToId,
      attachments: attachments.length ? attachments : undefined,
      mentions: mentions.length ? mentions : undefined,
    },
    select: { id: true, createdAt: true },
  });

  const dto = await loadDTO(message.id, ctx);
  publish(room.key, "message:new", dto);
  // The sender has read everything up to their own message
  await upsertReadState(ctx, room, message.createdAt);

  const preview = content
    ? (content.length > 120 ? `${content.slice(0, 120)}…` : content).replace(
        /<@([A-Za-z0-9_-]+)>/g,
        (_, id: string) => `@${dto.mentions.find((m) => m.id === id)?.name ?? "unknown"}`,
      )
    : "📎";
  const link = `/chat?room=${encodeURIComponent(room.key)}`;

  if (otherUserId) {
    void notify({
      tenantId: ctx.tenantId,
      type: "direct_message",
      title: `${dto.author.name} messaged you`,
      body: preview,
      link,
      userIds: [otherUserId],
    });
  }
  const mentionTargets = mentions.filter((id) => id !== otherUserId);
  if (mentionTargets.length) {
    void notify({
      tenantId: ctx.tenantId,
      type: "chat_mention",
      title: `${dto.author.name} mentioned you`,
      body: preview,
      link,
      userIds: mentionTargets,
    });
  }

  return dto;
}

export async function editMessage(messageId: string, content: string): Promise<MessageDTO> {
  const { ctx, message, room } = await requireMessage(messageId);
  if (message.userId !== ctx.userId) throw new Error("You can only edit your own messages");
  if (message.deletedAt) throw new Error("This message was deleted");
  const text = cleanContent(content);
  if (!text && storedAttachments(message.attachments).length === 0) throw new Error("Message is empty");

  const mentions = await allowedMentions(ctx, room, text);
  await prisma.message.update({
    where: { id: message.id },
    data: { content: text, editedAt: new Date(), mentions },
  });
  const dto = await loadDTO(message.id, ctx);
  publish(room.key, "message:updated", dto);
  return dto;
}

/** Soft delete: content, attachments and reactions are removed; the row stays as a placeholder. */
export async function deleteMessage(messageId: string): Promise<MessageDTO> {
  const { ctx, message, room } = await requireMessage(messageId);
  const own = message.userId === ctx.userId;
  if (!own && !ctx.isAdmin) throw new Error("You can only delete your own messages");
  if (message.deletedAt) return loadDTO(message.id, ctx);

  await prisma.$transaction([
    prisma.messageReaction.deleteMany({ where: { messageId: message.id } }),
    prisma.message.update({
      where: { id: message.id },
      data: { content: "", attachments: [], mentions: [], deletedAt: new Date(), deletedById: ctx.userId },
    }),
  ]);

  for (const a of storedAttachments(message.attachments)) void deleteFile(a.storagePath);

  if (!own) {
    logAuditAsync({ action: "delete", entityType: "message", entityId: message.id, metadata: { moderated: true } });
  }

  const dto = await loadDTO(message.id, ctx);
  publish(room.key, "message:updated", dto);
  return dto;
}

export async function toggleReaction(
  messageId: string,
  emoji: string,
): Promise<{ messageId: string; reactions: ReactionGroup[] }> {
  const { ctx, message, room } = await requireMessage(messageId);
  if (message.deletedAt) throw new Error("This message was deleted");
  if (!isValidEmoji(emoji)) throw new Error("Invalid reaction");

  const key = { messageId_userId_emoji: { messageId: message.id, userId: ctx.userId, emoji } };
  const existing = await prisma.messageReaction.findUnique({ where: key, select: { id: true } });
  if (existing) await prisma.messageReaction.delete({ where: { id: existing.id } });
  else await prisma.messageReaction.create({ data: { messageId: message.id, userId: ctx.userId, emoji } });

  const rows = await prisma.messageReaction.findMany({
    where: { messageId: message.id },
    select: { userId: true, emoji: true },
    orderBy: { createdAt: "asc" },
  });
  const reactions = groupReactions(rows, ctx.userId);
  publish(room.key, "reaction:updated", { room: room.key, messageId: message.id, reactions });
  return { messageId: message.id, reactions };
}

/** Mark the room read up to (and including) the given message. */
export async function markRead(roomKey: string, messageId: string): Promise<void> {
  const { ctx, room } = await requireRoomAccess(roomKey);
  const message = await prisma.message.findFirst({
    where: { id: messageId, tenantId: ctx.tenantId, ...roomWhere(room) },
    select: { createdAt: true },
  });
  if (!message) throw new Error("Not found");
  await upsertReadState(ctx, room, message.createdAt);
}

/** Find or create the DM with another member of this tenant; returns its room key. */
export async function openDirectConversation(otherUserId: string): Promise<string> {
  const ctx = await requireMember();
  if (typeof otherUserId !== "string" || otherUserId === ctx.userId) throw new Error("Invalid member");
  const other = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: otherUserId, tenantId: ctx.tenantId } },
    select: { id: true },
  });
  if (!other) throw new Error("User is not a member of this community");

  const [user1Id, user2Id] = ctx.userId < otherUserId ? [ctx.userId, otherUserId] : [otherUserId, ctx.userId];
  const existing = await prisma.directConversation.findUnique({
    where: { tenantId_user1Id_user2Id: { tenantId: ctx.tenantId, user1Id, user2Id } },
    select: { id: true },
  });
  if (existing) return `dm:${existing.id}`;

  const created = await prisma.directConversation.create({
    data: { tenantId: ctx.tenantId, user1Id, user2Id },
    select: { id: true },
  });
  const key = `dm:${created.id}`;
  // Let both participants' open streams subscribe to the new room
  publish(`user:${ctx.userId}`, "conversation:new", { room: key, otherUserId });
  publish(`user:${otherUserId}`, "conversation:new", { room: key, otherUserId: ctx.userId });
  return key;
}
