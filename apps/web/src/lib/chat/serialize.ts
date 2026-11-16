import { pickProfile, tenantProfileInclude } from "../profile";
import { roomKeyOf } from "./access";

/** Wire format for chat messages (shared by actions, stream and UI). */

export type ChatAuthor = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

export type ReactionGroup = { emoji: string; count: number; userIds: string[]; mine: boolean };

export type AttachmentDTO = {
  index: number;
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

export type MessageDTO = {
  id: string;
  room: string;
  author: ChatAuthor;
  /** null when the message was deleted */
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  replyTo: { id: string; authorName: string; excerpt: string | null; deleted: boolean } | null;
  reactions: ReactionGroup[];
  attachments: AttachmentDTO[];
  mentions: { id: string; name: string }[];
};

export type ReadStateDTO = { userId: string; lastReadAt: string };

/** Stored attachment metadata (never sent to clients — storagePath stays server-side). */
export type StoredAttachment = { name: string; mimeType: string; size: number; storagePath: string };

export function messageInclude(tenantId: string) {
  return {
    user: { select: { id: true, name: true, email: true, ...tenantProfileInclude(tenantId) } },
    replyTo: {
      select: {
        id: true,
        content: true,
        deletedAt: true,
        user: { select: { name: true, email: true } },
      },
    },
    reactions: { select: { userId: true, emoji: true }, orderBy: { createdAt: "asc" as const } },
  };
}

type Loaded = {
  id: string;
  channelId: string | null;
  directConversationId: string | null;
  userId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  attachments: unknown;
  mentions: unknown;
  user: {
    id: string;
    name: string | null;
    email: string;
    profiles?: { username: string | null; avatarUrl: string | null }[];
  };
  replyTo: {
    id: string;
    content: string;
    deletedAt: Date | null;
    user: { name: string | null; email: string };
  } | null;
  reactions: { userId: string; emoji: string }[];
};

export function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0];
}

export function toAuthor(user: Loaded["user"]): ChatAuthor {
  const profile = pickProfile(user);
  return {
    id: user.id,
    name: displayName(user),
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  };
}

export function groupReactions(rows: { userId: string; emoji: string }[], viewerId: string): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const r of rows) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [], mine: false };
    g.count++;
    g.userIds.push(r.userId);
    if (r.userId === viewerId) g.mine = true;
    map.set(r.emoji, g);
  }
  return [...map.values()];
}

export function storedAttachments(value: unknown): StoredAttachment[] {
  return Array.isArray(value) ? (value as StoredAttachment[]) : [];
}

const EXCERPT = 140;

/**
 * Serialize for a viewer. `mentionNames` resolves mentioned user ids → names.
 * Reactions carry userIds; `mine` is computed for the given viewer and
 * recomputed client-side for live events.
 */
export function toMessageDTO(
  m: Loaded,
  viewerId: string,
  mentionNames: Map<string, string> = new Map(),
): MessageDTO {
  const deleted = m.deletedAt !== null;
  const mentionIds = Array.isArray(m.mentions) ? (m.mentions as string[]) : [];
  return {
    id: m.id,
    room: roomKeyOf(m),
    author: toAuthor(m.user),
    content: deleted ? null : m.content,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deleted,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: displayName(m.replyTo.user),
          deleted: m.replyTo.deletedAt !== null,
          excerpt:
            m.replyTo.deletedAt !== null
              ? null
              : m.replyTo.content.length > EXCERPT
                ? `${m.replyTo.content.slice(0, EXCERPT)}…`
                : m.replyTo.content,
        }
      : null,
    reactions: deleted ? [] : groupReactions(m.reactions, viewerId),
    attachments: deleted
      ? []
      : storedAttachments(m.attachments).map((a, index) => ({
          index,
          name: a.name,
          mimeType: a.mimeType,
          size: a.size,
          url: `/api/chat/attachments/${m.id}/${index}`,
        })),
    mentions: deleted
      ? []
      : mentionIds.map((id) => ({ id, name: mentionNames.get(id) ?? "unknown" })),
  };
}

/** `<@userId>` mention tokens contained in a message body. */
export function extractMentionIds(content: string): string[] {
  return [...new Set([...content.matchAll(/<@([A-Za-z0-9_-]{1,64})>/g)].map((m) => m[1]))];
}
