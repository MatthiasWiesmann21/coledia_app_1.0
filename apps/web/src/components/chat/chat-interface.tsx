"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Hash, MessageCircle, Search } from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";
import { useConfirm } from "@/components/confirm-provider";
import { onStreamEvent } from "@/lib/chat/stream-client";
import {
  deleteMessage,
  editMessage,
  getMessages,
  getUnreadCounts,
  markRead,
  openDirectConversation,
  sendMessage,
  toggleReaction,
} from "@/lib/chat-message-actions";
import { ChatAvatar } from "./chat-avatar";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import type { ChatMember, MessageDTO, ReactionGroup, SendInput, UIMessage } from "./chat-types";

type Server = { id: string; name: string; channels: { id: string; name: string }[] };
type Conversation = { room: string; otherUserId: string };

type RoomState = {
  messages: UIMessage[];
  hasMore: boolean;
  loaded: boolean;
  loadingOlder: boolean;
  readStates: Record<string, string>;
  firstUnreadAt: string | null;
};

const EMPTY_ROOM: RoomState = {
  messages: [],
  hasMore: false,
  loaded: false,
  loadingOlder: false,
  readStates: {},
  firstUnreadAt: null,
};

function withMine(reactions: ReactionGroup[], meId: string): ReactionGroup[] {
  return reactions.map((r) => ({ ...r, mine: r.userIds.includes(meId) }));
}

function normalize(m: MessageDTO, meId: string): UIMessage {
  return { ...m, reactions: withMine(m.reactions, meId) };
}

/** Insert or replace by id, keeping chronological order. */
function upsert(list: UIMessage[], msg: UIMessage): UIMessage[] {
  const idx = list.findIndex((m) => m.id === msg.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = msg;
    return next;
  }
  const next = [...list, msg];
  next.sort((a, b) => (a.status && !b.status ? 1 : !a.status && b.status ? -1 : a.createdAt.localeCompare(b.createdAt)));
  return next;
}

export function ChatInterface({
  me,
  isAdmin,
  servers,
  members,
  conversations: initialConversations,
  initialUnread,
  initialRoom,
}: {
  me: ChatMember;
  isAdmin: boolean;
  servers: Server[];
  members: ChatMember[];
  conversations: Conversation[];
  initialUnread: Record<string, number>;
  initialRoom: string | null;
}) {
  const t = useTranslations("chat");
  const router = useRouter();
  const confirm = useConfirm();

  const firstChannel = servers[0]?.channels[0] ? `channel:${servers[0].channels[0].id}` : null;
  const [activeRoom, setActiveRoom] = useState<string | null>(initialRoom ?? firstChannel);
  const [mode, setMode] = useState<"channels" | "dms">(initialRoom?.startsWith("dm:") ? "dms" : "channels");
  const [mobileView, setMobileView] = useState<"list" | "room">(initialRoom ? "room" : "list");
  const [rooms, setRooms] = useState<Record<string, RoomState>>({});
  const [conversations, setConversations] = useState(initialConversations);
  const [unread, setUnread] = useState(initialUnread);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<Record<string, Record<string, { name: string; at: number }>>>({});
  const [replyTo, setReplyTo] = useState<UIMessage | null>(null);
  const [editing, setEditing] = useState<UIMessage | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Latest values for stream handlers registered once
  const activeRoomRef = useRef(activeRoom);
  const roomsRef = useRef(rooms);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  const lastMarked = useRef<Record<string, string>>({});

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const channelNames = useMemo(
    () => new Map<string, string>(servers.flatMap((s) => s.channels.map((c) => [`channel:${c.id}`, c.name]))),
    [servers],
  );

  const updateRoom = useCallback((key: string, fn: (r: RoomState) => RoomState) => {
    setRooms((prev) => ({ ...prev, [key]: fn(prev[key] ?? EMPTY_ROOM) }));
  }, []);

  const loadRoom = useCallback(
    async (key: string) => {
      try {
        const page = await getMessages(key);
        updateRoom(key, (r) => {
          const pending = r.messages.filter((m) => m.status);
          return {
            ...r,
            messages: [...page.messages.map((m) => normalize(m, me.id)), ...pending],
            hasMore: page.hasMore,
            loaded: true,
            readStates: Object.fromEntries(page.readStates.map((s) => [s.userId, s.lastReadAt])),
            firstUnreadAt: r.loaded
              ? r.firstUnreadAt
              : (page.readStates.find((s) => s.userId === me.id)?.lastReadAt ?? "1970-01-01T00:00:00.000Z"),
          };
        });
      } catch {
        setError(t("loadFailed"));
        updateRoom(key, (r) => ({ ...r, loaded: true }));
      }
    },
    [me.id, t, updateRoom],
  );

  // Load the active room on first open
  useEffect(() => {
    if (activeRoom && !roomsRef.current[activeRoom]?.loaded) void loadRoom(activeRoom);
  }, [activeRoom, loadRoom]);

  // ─── Live events ──────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      onStreamEvent("ready", ({ online: ids }: { online: string[] }) => setOnline(new Set(ids))),
      onStreamEvent("presence", ({ userId, online: isOnline }: { userId: string; online: boolean }) =>
        setOnline((prev) => {
          const next = new Set(prev);
          if (isOnline) next.add(userId);
          else next.delete(userId);
          return next;
        }),
      ),
      onStreamEvent("message:new", (dto: MessageDTO) => {
        const msg = normalize(dto, me.id);
        if (roomsRef.current[dto.room]?.loaded) {
          updateRoom(dto.room, (r) => {
            let list = r.messages;
            // Drop the matching optimistic copy of my own message
            if (dto.author.id === me.id && !list.some((m) => m.id === dto.id)) {
              const tmp = list.find((m) => m.status === "pending" && m.sendInput?.content === dto.content);
              if (tmp) list = list.filter((m) => m.id !== tmp.id);
            }
            return { ...r, messages: upsert(list, msg) };
          });
        }
        if (dto.author.id !== me.id) {
          setTyping((prev) => {
            if (!prev[dto.room]?.[dto.author.id]) return prev;
            const roomTyping = { ...prev[dto.room] };
            delete roomTyping[dto.author.id];
            return { ...prev, [dto.room]: roomTyping };
          });
          if (dto.room !== activeRoomRef.current || document.hidden) {
            setUnread((u) => ({ ...u, [dto.room]: (u[dto.room] ?? 0) + 1 }));
          }
          if (dto.room.startsWith("dm:")) {
            setConversations((list) =>
              list.some((c) => c.room === dto.room) ? list : [{ room: dto.room, otherUserId: dto.author.id }, ...list],
            );
          }
        }
      }),
      onStreamEvent("message:updated", (dto: MessageDTO) => {
        const msg = normalize(dto, me.id);
        updateRoom(dto.room, (r) => ({
          ...r,
          messages: r.messages.map((m) => {
            if (m.id === dto.id) return msg;
            if (m.replyTo?.id === dto.id) {
              return {
                ...m,
                replyTo: {
                  ...m.replyTo,
                  deleted: dto.deleted,
                  excerpt: dto.deleted ? null : (dto.content ?? "").slice(0, 140),
                },
              };
            }
            return m;
          }),
        }));
        setEditing((e) => (e?.id === dto.id && dto.deleted ? null : e));
        setReplyTo((r) => (r?.id === dto.id && dto.deleted ? null : r));
      }),
      onStreamEvent(
        "reaction:updated",
        ({ room, messageId, reactions }: { room: string; messageId: string; reactions: ReactionGroup[] }) =>
          updateRoom(room, (r) => ({
            ...r,
            messages: r.messages.map((m) => (m.id === messageId ? { ...m, reactions: withMine(reactions, me.id) } : m)),
          })),
      ),
      onStreamEvent("read:updated", ({ room, userId, lastReadAt }: { room: string; userId: string; lastReadAt: string }) => {
        updateRoom(room, (r) =>
          (r.readStates[userId] ?? "") >= lastReadAt ? r : { ...r, readStates: { ...r.readStates, [userId]: lastReadAt } },
        );
        if (userId === me.id) setUnread((u) => ({ ...u, [room]: 0 }));
      }),
      onStreamEvent("typing", ({ room, userId, name, typing: isTyping }: { room: string; userId: string; name: string; typing: boolean }) => {
        if (userId === me.id) return;
        setTyping((prev) => {
          const roomTyping = { ...(prev[room] ?? {}) };
          if (isTyping) roomTyping[userId] = { name, at: Date.now() };
          else delete roomTyping[userId];
          return { ...prev, [room]: roomTyping };
        });
      }),
      onStreamEvent("conversation:new", ({ room, otherUserId }: { room: string; otherUserId: string }) =>
        setConversations((list) => (list.some((c) => c.room === room) ? list : [{ room, otherUserId }, ...list])),
      ),
      onStreamEvent("rooms:changed", () => router.refresh()),
      onStreamEvent("reconnected", () => {
        // Fill gaps: drop cached rooms and reload the open one
        setRooms((prev) => {
          const keep: Record<string, RoomState> = {};
          const active = activeRoomRef.current;
          if (active && prev[active]) keep[active] = prev[active];
          return keep;
        });
        if (activeRoomRef.current) void loadRoom(activeRoomRef.current);
        void getUnreadCounts().then(setUnread).catch(() => {});
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [me.id, updateRoom, loadRoom, router]);

  // Expire stale typing indicators
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - 7000;
      setTyping((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [room, users] of Object.entries(prev)) {
          next[room] = {};
          for (const [id, v] of Object.entries(users)) {
            if (v.at >= cutoff) next[room][id] = v;
            else changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // ─── Mark read when the latest message is visible ─────────────
  const active = activeRoom ? (rooms[activeRoom] ?? EMPTY_ROOM) : EMPTY_ROOM;
  const lastConfirmed = useMemo(() => {
    for (let i = active.messages.length - 1; i >= 0; i--) if (!active.messages[i].status) return active.messages[i];
    return null;
  }, [active.messages]);

  useEffect(() => {
    if (!activeRoom || !lastConfirmed || !atBottom) return;
    const tryMark = () => {
      if (document.hidden || lastMarked.current[activeRoom] === lastConfirmed.id) return;
      const mine = active.readStates[me.id];
      lastMarked.current[activeRoom] = lastConfirmed.id;
      setUnread((u) => (u[activeRoom] ? { ...u, [activeRoom]: 0 } : u));
      if (mine && mine >= lastConfirmed.createdAt) return;
      void markRead(activeRoom, lastConfirmed.id).catch(() => {
        delete lastMarked.current[activeRoom];
      });
    };
    tryMark();
    document.addEventListener("visibilitychange", tryMark);
    return () => document.removeEventListener("visibilitychange", tryMark);
  }, [activeRoom, lastConfirmed, atBottom, active.readStates, me.id]);

  // ─── Actions ──────────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    const key = activeRoomRef.current;
    const r = key ? roomsRef.current[key] : undefined;
    if (!key || !r || r.loadingOlder || !r.hasMore) return;
    const oldest = r.messages.find((m) => !m.status);
    if (!oldest) return;
    updateRoom(key, (s) => ({ ...s, loadingOlder: true }));
    try {
      const page = await getMessages(key, { before: oldest.id });
      updateRoom(key, (s) => ({
        ...s,
        loadingOlder: false,
        hasMore: page.hasMore,
        messages: [...page.messages.map((m) => normalize(m, me.id)).filter((m) => !s.messages.some((x) => x.id === m.id)), ...s.messages],
      }));
    } catch {
      updateRoom(key, (s) => ({ ...s, loadingOlder: false }));
      setError(t("loadFailed"));
    }
  }, [me.id, t, updateRoom]);

  const doSend = useCallback(
    async (room: string, input: SendInput, tempId: string) => {
      try {
        const dto = await sendMessage(room, input);
        updateRoom(room, (r) => ({
          ...r,
          messages: upsert(
            r.messages.filter((m) => m.id !== tempId),
            normalize(dto, me.id),
          ),
        }));
      } catch {
        updateRoom(room, (r) => ({
          ...r,
          messages: r.messages.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
        }));
      }
    },
    [me.id, updateRoom],
  );

  function handleSend(input: SendInput) {
    if (!activeRoom) return;
    const room = activeRoom;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const reply = replyTo;
    const temp: UIMessage = {
      id: tempId,
      room,
      author: me,
      content: input.content,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      replyTo: reply
        ? { id: reply.id, authorName: reply.author.name, excerpt: reply.content, deleted: false }
        : null,
      reactions: [],
      attachments: input.attachments.map((a, index) => ({ index, name: a.name, mimeType: a.mimeType, size: a.size, url: "" })),
      mentions: [...input.content.matchAll(/<@([A-Za-z0-9_-]{1,64})>/g)].map((m) => ({
        id: m[1],
        name: memberMap.get(m[1])?.name ?? t("unknownUser"),
      })),
      status: "pending",
      sendInput: input,
    };
    updateRoom(room, (r) => ({ ...r, messages: [...r.messages, temp] }));
    setReplyTo(null);
    void doSend(room, input, tempId);
  }

  function handleRetry(m: UIMessage) {
    if (!m.sendInput) return;
    updateRoom(m.room, (r) => ({
      ...r,
      messages: r.messages.map((x) => (x.id === m.id ? { ...x, status: "pending" } : x)),
    }));
    void doSend(m.room, m.sendInput, m.id);
  }

  function handleDiscard(m: UIMessage) {
    updateRoom(m.room, (r) => ({ ...r, messages: r.messages.filter((x) => x.id !== m.id) }));
  }

  async function handleSaveEdit(m: UIMessage, content: string) {
    setEditing(null);
    if (content === m.content) return;
    try {
      const dto = await editMessage(m.id, content);
      updateRoom(m.room, (r) => ({ ...r, messages: upsert(r.messages, normalize(dto, me.id)) }));
    } catch {
      setError(t("editFailed"));
    }
  }

  async function handleDelete(m: UIMessage) {
    const ok = await confirm({
      title: t("deleteTitle"),
      description: m.author.id === me.id ? t("deleteDescription") : t("deleteModerateDescription"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!ok) return;
    try {
      const dto = await deleteMessage(m.id);
      updateRoom(m.room, (r) => ({ ...r, messages: upsert(r.messages, normalize(dto, me.id)) }));
    } catch {
      setError(t("deleteFailed"));
    }
  }

  async function handleReact(m: UIMessage, emoji: string) {
    // Optimistic toggle
    const apply = (reactions: ReactionGroup[]) =>
      updateRoom(m.room, (r) => ({
        ...r,
        messages: r.messages.map((x) => (x.id === m.id ? { ...x, reactions } : x)),
      }));
    const existing = m.reactions.find((r) => r.emoji === emoji);
    const optimistic = existing
      ? m.reactions
          .map((r) =>
            r.emoji !== emoji
              ? r
              : r.mine
                ? { ...r, count: r.count - 1, mine: false, userIds: r.userIds.filter((id) => id !== me.id) }
                : { ...r, count: r.count + 1, mine: true, userIds: [...r.userIds, me.id] },
          )
          .filter((r) => r.count > 0)
      : [...m.reactions, { emoji, count: 1, mine: true, userIds: [me.id] }];
    apply(optimistic);
    try {
      const res = await toggleReaction(m.id, emoji);
      apply(withMine(res.reactions, me.id));
    } catch {
      apply(m.reactions);
      setError(t("reactFailed"));
    }
  }

  function handleEditLast() {
    const own = [...active.messages].reverse().find((m) => m.author.id === me.id && !m.status && !m.deleted && m.content);
    if (own) {
      setReplyTo(null);
      setEditing(own);
    }
  }

  async function openDm(userId: string) {
    const existing = conversations.find((c) => c.otherUserId === userId);
    try {
      const room = existing?.room ?? (await openDirectConversation(userId));
      if (!existing) setConversations((list) => (list.some((c) => c.room === room) ? list : [{ room, otherUserId: userId }, ...list]));
      selectRoom(room);
      setMemberSearch("");
    } catch {
      setError(t("openDmFailed"));
    }
  }

  function selectRoom(room: string) {
    if (room !== activeRoom) {
      setReplyTo(null);
      setEditing(null);
      setError(null);
      setAtBottom(true);
    }
    setActiveRoom(room);
    setMobileView("room");
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.history.replaceState(null, "", url);
  }

  // ─── Derived view data ────────────────────────────────────────
  const activeDm = activeRoom?.startsWith("dm:") ? conversations.find((c) => c.room === activeRoom) : undefined;
  const dmUser = activeDm ? memberMap.get(activeDm.otherUserId) : undefined;
  const title = activeDm ? (dmUser?.name ?? t("unknownUser")) : activeRoom ? (channelNames.get(activeRoom) ?? "") : "";
  const typingNames = Object.values((activeRoom && typing[activeRoom]) || {}).map((v) => v.name);

  const filteredMembers = members
    .filter((m) => m.id !== me.id)
    .filter((m) => {
      const q = memberSearch.trim().toLowerCase();
      return !q || m.name.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q);
    });
  const channelUnread = Object.entries(unread).filter(([k, v]) => k.startsWith("channel:") && v > 0).length;
  const dmUnread = Object.entries(unread).filter(([k, v]) => k.startsWith("dm:") && v > 0).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border bg-card md:w-64",
          mobileView === "room" ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex gap-1 border-b border-border p-2">
          {(["channels", "dms"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition",
                mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {m === "channels" ? <Hash className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              {m === "channels" ? t("channels") : t("directMessages")}
              {(m === "channels" ? channelUnread : dmUnread) > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mode === "channels" ? (
            servers.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t("noServers")}</p>
            ) : (
              servers.map((server) => (
                <div key={server.id} className="mb-4">
                  <p className="mb-1 truncate px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {server.name}
                  </p>
                  {server.channels.length === 0 && (
                    <p className="px-2 text-xs text-muted-foreground">{t("noChannels")}</p>
                  )}
                  <ul className="flex flex-col gap-0.5">
                    {server.channels.map((c) => {
                      const key = `channel:${c.id}`;
                      return (
                        <li key={c.id}>
                          <RoomButton
                            active={activeRoom === key}
                            unread={unread[key] ?? 0}
                            onClick={() => selectRoom(key)}
                            icon={<Hash className="h-4 w-4 shrink-0" />}
                            label={c.name}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder={t("searchMembers")}
                  className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {!memberSearch && conversations.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("conversations")}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {conversations.map((c) => {
                      const user = memberMap.get(c.otherUserId);
                      return (
                        <li key={c.room}>
                          <RoomButton
                            active={activeRoom === c.room}
                            unread={unread[c.room] ?? 0}
                            onClick={() => selectRoom(c.room)}
                            icon={
                              <ChatAvatar
                                name={user?.name ?? "?"}
                                avatarUrl={user?.avatarUrl ?? null}
                                size="sm"
                                online={online.has(c.otherUserId)}
                              />
                            }
                            label={user?.name ?? t("unknownUser")}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("members")}
              </p>
              <ul className="flex flex-col gap-0.5">
                {filteredMembers.map((m) => (
                  <li key={m.id}>
                    <RoomButton
                      active={activeDm?.otherUserId === m.id}
                      unread={0}
                      onClick={() => void openDm(m.id)}
                      icon={<ChatAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" online={online.has(m.id)} />}
                      label={m.name}
                      sublabel={m.username ? `@${m.username}` : undefined}
                    />
                  </li>
                ))}
                {filteredMembers.length === 0 && (
                  <li className="px-2 py-2 text-xs text-muted-foreground">{t("noMembersFound")}</li>
                )}
              </ul>
            </>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className={cn("min-w-0 flex-1 flex-col", mobileView === "list" ? "hidden md:flex" : "flex")}>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => setMobileView("list")}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {activeRoom ? (
            activeDm ? (
              <>
                <ChatAvatar
                  name={title}
                  avatarUrl={dmUser?.avatarUrl ?? null}
                  size="sm"
                  online={online.has(activeDm.otherUserId)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {online.has(activeDm.otherUserId) ? t("online") : t("offline")}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Hash className="h-4 w-4 text-muted-foreground" />
                <p className="truncate text-sm font-semibold">{title}</p>
              </>
            )
          ) : (
            <p className="text-sm text-muted-foreground">{t("selectConversation")}</p>
          )}
        </header>

        {error && (
          <div className="flex items-center justify-between border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="underline">
              {t("dismiss")}
            </button>
          </div>
        )}

        {activeRoom ? (
          <>
            <MessageList
              roomKey={activeRoom}
              isDm={!!activeDm}
              messages={active.messages}
              hasMore={active.hasMore}
              loadingOlder={active.loadingOlder}
              loaded={active.loaded}
              readStates={active.readStates}
              firstUnreadAt={active.firstUnreadAt}
              me={me}
              isAdmin={isAdmin}
              members={memberMap}
              emptyText={activeDm ? t("emptyDm", { name: title }) : t("emptyChannel", { name: title })}
              onLoadOlder={loadOlder}
              onAtBottomChange={setAtBottom}
              onReply={(m) => {
                setEditing(null);
                setReplyTo(m);
              }}
              onEdit={(m) => {
                setReplyTo(null);
                setEditing(m);
              }}
              onDelete={handleDelete}
              onReact={handleReact}
              onRetry={handleRetry}
              onDiscard={handleDiscard}
            />
            <div className="h-5 shrink-0 px-4 text-[11px] text-muted-foreground" aria-live="polite">
              {typingNames.length === 1
                ? t("typingOne", { name: typingNames[0] })
                : typingNames.length === 2
                  ? t("typingTwo", { a: typingNames[0], b: typingNames[1] })
                  : typingNames.length > 2
                    ? t("typingMany")
                    : ""}
            </div>
            <Composer
              key={activeRoom}
              roomKey={activeRoom}
              members={members}
              meId={me.id}
              placeholder={activeDm ? t("messagePerson", { name: title }) : t("messageChannel", { name: title })}
              replyTo={replyTo}
              editing={editing}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditing(null)}
              onSend={handleSend}
              onSaveEdit={handleSaveEdit}
              onEditLast={handleEditLast}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {servers.length === 0 && members.length <= 1 ? t("noServers") : t("selectConversation")}
          </div>
        )}
      </section>
    </div>
  );
}

function RoomButton({
  active,
  unread,
  onClick,
  icon,
  label,
  sublabel,
}: {
  active: boolean;
  unread: number;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
        active ? "bg-primary/15 text-primary" : unread > 0 ? "font-semibold text-foreground hover:bg-muted" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sublabel && <span className="block truncate text-[11px] font-normal text-muted-foreground">{sublabel}</span>}
      </span>
      {unread > 0 && !active && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
