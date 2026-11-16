"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowDown, Loader2 } from "lucide-react";
import { MessageItem } from "./message-item";
import type { ChatMember, UIMessage } from "./chat-types";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MessageList({
  roomKey,
  isDm,
  messages,
  hasMore,
  loadingOlder,
  loaded,
  readStates,
  firstUnreadAt,
  me,
  isAdmin,
  members,
  emptyText,
  onLoadOlder,
  onAtBottomChange,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRetry,
  onDiscard,
}: {
  roomKey: string;
  isDm: boolean;
  messages: UIMessage[];
  hasMore: boolean;
  loadingOlder: boolean;
  loaded: boolean;
  /** userId → lastReadAt (ISO) */
  readStates: Record<string, string>;
  /** My read position when the room was opened — drives the "New messages" divider */
  firstUnreadAt: string | null;
  me: ChatMember;
  isAdmin: boolean;
  members: Map<string, ChatMember>;
  emptyText: string;
  onLoadOlder: () => void;
  onAtBottomChange: (atBottom: boolean) => void;
  onReply: (m: UIMessage) => void;
  onEdit: (m: UIMessage) => void;
  onDelete: (m: UIMessage) => void;
  onReact: (m: UIMessage, emoji: string) => void;
  onRetry: (m: UIMessage) => void;
  onDiscard: (m: UIMessage) => void;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const prevFirstId = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);
  const prevLastId = useRef<string | null>(null);
  const initialScrollDone = useRef(false);

  // Reset per room
  useEffect(() => {
    initialScrollDone.current = false;
    prevFirstId.current = null;
    prevLastId.current = null;
  }, [roomKey]);

  // Keep scroll position stable when older messages are prepended, and stick
  // to the bottom for new messages when the user is already there.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;

    if (!initialScrollDone.current && loaded) {
      el.scrollTop = el.scrollHeight;
      initialScrollDone.current = true;
    } else if (prevFirstId.current && firstId !== prevFirstId.current && lastId === prevLastId.current) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
    } else if (lastId !== prevLastId.current) {
      const last = messages[messages.length - 1];
      if (atBottomRef.current || last?.author.id === me.id) el.scrollTop = el.scrollHeight;
    }

    prevFirstId.current = firstId;
    prevLastId.current = lastId;
    prevScrollHeight.current = el.scrollHeight;
  }, [messages, loaded, me.id]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (bottom !== atBottomRef.current) {
      atBottomRef.current = bottom;
      setAtBottom(bottom);
      onAtBottomChange(bottom);
    }
    prevScrollHeight.current = el.scrollHeight;
    if (el.scrollTop < 120 && hasMore && !loadingOlder && loaded) onLoadOlder();
  }, [hasMore, loadingOlder, loaded, onLoadOlder, onAtBottomChange]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  function jumpTo(messageId: string) {
    const node = document.getElementById(`msg-${messageId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((id) => (id === messageId ? null : id)), 1800);
  }

  // Seen indicators
  const { seenByMessage, dmSeenAt } = useMemo(() => {
    const confirmed = messages.filter((m) => !m.status);
    const seenBy = new Map<string, ChatMember[]>();
    let otherRead: string | null = null;
    for (const [userId, lastReadAt] of Object.entries(readStates)) {
      if (userId === me.id) continue;
      if (isDm) {
        otherRead = lastReadAt;
        continue;
      }
      const member = members.get(userId);
      if (!member) continue;
      // Latest message this member has read (not authored by them)
      let target: UIMessage | undefined;
      for (let i = confirmed.length - 1; i >= 0; i--) {
        if (confirmed[i].createdAt <= lastReadAt) {
          target = confirmed[i];
          break;
        }
      }
      if (!target || target.author.id === userId) continue;
      seenBy.set(target.id, [...(seenBy.get(target.id) ?? []), member]);
    }
    return { seenByMessage: seenBy, dmSeenAt: otherRead };
  }, [messages, readStates, members, me.id, isDm]);

  // Show the DM "seen/sent" marker only on my latest message
  const lastOwnId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].author.id === me.id && !messages[i].status && !messages[i].deleted) return messages[i].id;
    }
    return null;
  }, [messages, me.id]);

  const firstUnreadId = useMemo(() => {
    if (!firstUnreadAt) return null;
    return messages.find((m) => m.author.id !== me.id && !m.status && m.createdAt > firstUnreadAt)?.id ?? null;
  }, [messages, firstUnreadAt, me.id]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto py-3">
        {!loaded ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <>
            {hasMore ? (
              <div className="flex justify-center py-2">
                {loadingOlder ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <button type="button" onClick={onLoadOlder} className="text-xs text-primary hover:underline">
                    {t("loadOlder")}
                  </button>
                )}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-muted-foreground">{t("beginningOfHistory")}</p>
            )}
            <ul className="flex flex-col">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const date = new Date(m.createdAt);
                const newDay = !prev || !sameDay(new Date(prev.createdAt), date);
                const grouped =
                  !!prev &&
                  !newDay &&
                  m.id !== firstUnreadId &&
                  prev.author.id === m.author.id &&
                  !prev.deleted &&
                  !m.replyTo &&
                  date.getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
                return (
                  <Fragment key={m.id}>
                    {newDay && (
                      <li className="my-3 flex items-center gap-3 px-3" aria-hidden>
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {sameDay(date, new Date())
                            ? t("today")
                            : format.dateTime(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </li>
                    )}
                    {m.id === firstUnreadId && (
                      <li className="my-2 flex items-center gap-3 px-3" aria-hidden>
                        <span className="h-px flex-1 bg-red-500/60" />
                        <span className="text-xs font-semibold text-red-600">{t("newMessages")}</span>
                        <span className="h-px flex-1 bg-red-500/60" />
                      </li>
                    )}
                    <MessageItem
                      message={m}
                      me={me}
                      isAdmin={isAdmin}
                      grouped={grouped}
                      members={members}
                      seenBy={seenByMessage.get(m.id) ?? []}
                      dmSeen={isDm && m.id === lastOwnId ? !!dmSeenAt && dmSeenAt >= m.createdAt : undefined}
                      highlighted={highlightId === m.id}
                      onReply={onReply}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onReact={onReact}
                      onRetry={onRetry}
                      onDiscard={onDiscard}
                      onJumpTo={jumpTo}
                    />
                  </Fragment>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {!atBottom && loaded && messages.length > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 right-4 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-md transition hover:bg-muted"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {t("jumpToLatest")}
        </button>
      )}
    </div>
  );
}
