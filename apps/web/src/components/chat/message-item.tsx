"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  FileText,
  Pencil,
  RotateCcw,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import { ChatAvatar } from "./chat-avatar";
import { ReactionPicker } from "./reaction-picker";
import type { ChatMember, UIMessage } from "./chat-types";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Render text with @mentions, links and line breaks — never as HTML. */
function renderContent(
  content: string,
  mentionName: (id: string) => string,
  meId: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  const parts = content.split(/(<@[A-Za-z0-9_-]{1,64}>)/g);
  parts.forEach((part, i) => {
    const mention = /^<@([A-Za-z0-9_-]{1,64})>$/.exec(part);
    if (mention) {
      const id = mention[1];
      out.push(
        <span
          key={`m${i}`}
          className={cn(
            "rounded px-0.5 font-medium",
            id === meId ? "bg-amber-400/25 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary",
          )}
        >
          @{mentionName(id)}
        </span>,
      );
      return;
    }
    part.split(URL_RE).forEach((chunk, j) => {
      if (/^https?:\/\//.test(chunk)) {
        out.push(
          <a
            key={`u${i}-${j}`}
            href={chunk}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline underline-offset-2 break-all"
          >
            {chunk}
          </a>,
        );
      } else if (chunk) {
        out.push(<Fragment key={`t${i}-${j}`}>{chunk}</Fragment>);
      }
    });
  });
  return out;
}

export function MessageItem({
  message,
  me,
  isAdmin,
  grouped,
  members,
  seenBy,
  dmSeen,
  highlighted,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRetry,
  onDiscard,
  onJumpTo,
}: {
  message: UIMessage;
  me: ChatMember;
  isAdmin: boolean;
  /** Same author as the previous message within a few minutes */
  grouped: boolean;
  members: Map<string, ChatMember>;
  /** Channel: members whose read position is at this message */
  seenBy: ChatMember[];
  /** DM: undefined when not own message, otherwise whether the other side has read it */
  dmSeen?: boolean;
  highlighted: boolean;
  onReply: (m: UIMessage) => void;
  onEdit: (m: UIMessage) => void;
  onDelete: (m: UIMessage) => void;
  onReact: (m: UIMessage, emoji: string) => void;
  onRetry: (m: UIMessage) => void;
  onDiscard: (m: UIMessage) => void;
  onJumpTo: (messageId: string) => void;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const [picker, setPicker] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const own = message.author.id === me.id;
  const confirmed = !message.status;
  const created = new Date(message.createdAt);
  const time = format.dateTime(created, { hour: "2-digit", minute: "2-digit" });
  const fullDate = format.dateTime(created, { dateStyle: "full", timeStyle: "short" });
  const mentionName = (id: string) =>
    message.mentions.find((m) => m.id === id)?.name ?? members.get(id)?.name ?? t("unknownUser");

  const canAct = confirmed && !message.deleted;
  const reactionNames = (userIds: string[]) =>
    userIds.map((id) => (id === me.id ? t("you") : (members.get(id)?.name ?? t("unknownUser")))).join(", ");

  return (
    <li
      id={`msg-${message.id}`}
      className={cn(
        "group relative flex gap-3 rounded-lg px-3 transition-colors hover:bg-muted/40",
        grouped ? "py-0.5" : "mt-2 pt-1.5 pb-0.5",
        highlighted && "bg-amber-400/15",
        message.status === "pending" && "opacity-70",
      )}
      onClick={() => setActionsOpen((v) => !v)}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0">
        {grouped ? (
          <span
            className="hidden pt-0.5 text-[10px] text-muted-foreground group-hover:inline"
            title={fullDate}
          >
            {time}
          </span>
        ) : (
          <ChatAvatar name={message.author.name} avatarUrl={message.author.avatarUrl} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{message.author.name}</span>
            {message.author.username && (
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                @{message.author.username}
              </span>
            )}
            <time dateTime={message.createdAt} title={fullDate} className="shrink-0 text-xs text-muted-foreground">
              {time}
            </time>
          </div>
        )}

        {/* Reply quote */}
        {message.replyTo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJumpTo(message.replyTo!.id);
            }}
            className="mb-0.5 mt-0.5 flex max-w-full items-center gap-1.5 border-l-2 border-primary/50 pl-2 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            <span className="shrink-0 font-medium">{message.replyTo.authorName}</span>
            <span className="truncate italic">
              {message.replyTo.deleted
                ? t("deletedMessage")
                : renderContent(message.replyTo.excerpt ?? "", mentionName, me.id)}
            </span>
          </button>
        )}

        {/* Body */}
        {message.deleted ? (
          <p className="text-sm italic text-muted-foreground">{t("deletedMessage")}</p>
        ) : (
          message.content && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {renderContent(message.content, mentionName, me.id)}
              {message.editedAt && (
                <span
                  className="ml-1 text-[11px] text-muted-foreground"
                  title={format.dateTime(new Date(message.editedAt), { dateStyle: "medium", timeStyle: "short" })}
                >
                  ({t("edited")})
                </span>
              )}
            </p>
          )
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.attachments.map((a) =>
              a.mimeType.startsWith("image/") && a.url ? (
                <a key={a.index} href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.name}
                    loading="lazy"
                    className="max-h-60 max-w-[min(100%,20rem)] rounded-lg border border-border object-contain"
                  />
                </a>
              ) : (
                <a
                  key={a.index}
                  href={a.url ? `${a.url}?download=1` : undefined}
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-w-xs items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition hover:bg-muted"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(a.size)}</span>
                </a>
              ),
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={!canAct}
                title={reactionNames(r.userIds)}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(message, r.emoji);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                  r.mine
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="text-sm leading-none">{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Delivery state */}
        {message.status === "pending" && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {t("sending")}
          </p>
        )}
        {message.status === "failed" && (
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-red-600">
            <AlertCircle className="h-3 w-3" /> {t("sendFailed")}
            <button type="button" onClick={() => onRetry(message)} className="flex items-center gap-0.5 underline">
              <RotateCcw className="h-3 w-3" /> {t("retry")}
            </button>
            <button type="button" onClick={() => onDiscard(message)} className="flex items-center gap-0.5 underline">
              <X className="h-3 w-3" /> {t("discard")}
            </button>
          </p>
        )}

        {/* Seen indicators */}
        {dmSeen !== undefined && confirmed && !message.deleted && (
          <p
            className={cn("mt-0.5 flex items-center gap-1 text-[11px]", dmSeen ? "text-primary" : "text-muted-foreground")}
            aria-label={dmSeen ? t("seen") : t("sent")}
          >
            {dmSeen ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {dmSeen ? t("seen") : t("sent")}
          </p>
        )}
        {seenBy.length > 0 && (
          <div
            className="mt-0.5 flex items-center justify-end gap-0.5"
            title={t("seenBy", { names: seenBy.map((m) => m.name).join(", ") })}
          >
            {seenBy.slice(0, 5).map((m) => (
              <ChatAvatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} size="xs" />
            ))}
            {seenBy.length > 5 && <span className="text-[10px] text-muted-foreground">+{seenBy.length - 5}</span>}
          </div>
        )}
      </div>

      {/* Hover / tap actions */}
      {canAct && (
        <div
          className={cn(
            "absolute -top-3 right-3 z-10 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm",
            actionsOpen || picker ? "flex" : "hidden group-hover:flex",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionButton label={t("addReaction")} onClick={() => setPicker((v) => !v)}>
            <SmilePlus className="h-4 w-4" />
          </ActionButton>
          <ActionButton label={t("reply")} onClick={() => onReply(message)}>
            <CornerUpLeft className="h-4 w-4" />
          </ActionButton>
          {own && (
            <ActionButton label={t("edit")} onClick={() => onEdit(message)}>
              <Pencil className="h-4 w-4" />
            </ActionButton>
          )}
          {(own || isAdmin) && (
            <ActionButton label={t("delete")} onClick={() => onDelete(message)} destructive>
              <Trash2 className="h-4 w-4" />
            </ActionButton>
          )}
          {picker && (
            <div className="absolute right-0 top-full mt-1">
              <ReactionPicker
                onPick={(emoji) => {
                  setPicker(false);
                  setActionsOpen(false);
                  onReact(message, emoji);
                }}
                onClose={() => setPicker(false)}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted",
        destructive ? "hover:text-red-600" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
