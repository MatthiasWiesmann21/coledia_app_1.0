import type { AttachmentDTO, MessageDTO, ReactionGroup } from "@/lib/chat/serialize";

export type { AttachmentDTO, MessageDTO, ReactionGroup };

export type ChatMember = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

/** Attachment metadata returned by /api/chat/attachments and passed to sendMessage. */
export type UploadedAttachment = { name: string; mimeType: string; size: number; storagePath: string };

export type SendInput = { content: string; replyToId: string | null; attachments: UploadedAttachment[] };

export type UIMessage = MessageDTO & {
  /** Optimistic local message state; undefined once confirmed by the server. */
  status?: "pending" | "failed";
  sendInput?: SendInput;
};

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "🔥"];

export const MORE_REACTIONS = [
  "😀", "😁", "😅", "🤣", "😊", "😍", "😘", "😎", "🤔", "🙄", "😴", "🤯",
  "😡", "🥳", "😇", "🤗", "🤝", "👏", "🙌", "💪", "👀", "✅", "❌", "⭐",
  "💯", "🚀", "🎯", "💡", "📌", "⚽", "🏆", "☕", "🍕", "🎂", "🌟", "💙",
];
