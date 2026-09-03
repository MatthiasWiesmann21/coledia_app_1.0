"use client";

import { useState, useEffect, useRef } from "react";
import {
  Hash,
  Send,
  Users,
  MessageCircle,
  Plus,
  ChevronDown,
  Smile,
  Reply,
  X,
} from "lucide-react";
import { getSocket, disconnectSocket } from "@/lib/socket";

type Channel = { id: string; name: string; type: string };
type ChatServer = {
  id: string;
  name: string;
  channels: Channel[];
  members: {
    userId: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    role: string;
  }[];
};

type TenantMember = {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

type DMConversation = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserUsername: string | null;
  otherUserAvatarUrl: string | null;
};

type Reaction = { userId: string; emoji: string };

type ReplyData = {
  id: string;
  content: string;
  userId: string;
  userName: string;
};

type Message = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  replyTo?: ReplyData | null;
  reactions?: Reaction[];
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🔥"];

export function ChatInterface({
  currentUserId,
  currentUserName,
  chatServers,
  tenantMembers,
  dmConversations,
  tenantId,
}: {
  currentUserId: string;
  currentUserName: string;
  chatServers: ChatServer[];
  tenantMembers: TenantMember[];
  dmConversations: DMConversation[];
  tenantId: string;
}) {
  const [mode, setMode] = useState<"channels" | "dms">("channels");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    chatServers[0]?.channels[0]?.id ?? null,
  );
  const [activeDMUserId, setActiveDMUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [socket, setSocket] = useState<ReturnType<typeof getSocket> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Reaction picker state: which message id is showing the picker
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(
    null,
  );

  // Initialize socket connection
  useEffect(() => {
    const s = getSocket(currentUserId, tenantId);
    setSocket(s);

    s.on("presence:online", ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    s.on("presence:offline", ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    s.on("presence:list", ({ online }: { online: string[] }) => {
      setOnlineUsers(new Set(online));
    });

    s.emit("presence:request");

    return () => {
      disconnectSocket();
    };
  }, [currentUserId, tenantId]);

  // Join channel when active channel changes
  useEffect(() => {
    if (!socket || !activeChannelId) return;

    let cancelled = false;
    setMessages([]);
    setTypingUsers(new Set());

    // Fetch message history from the database
    fetch(`/api/chat/channels/${activeChannelId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.messages) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});

    socket.emit("channel:join", activeChannelId);

    const handleMessage = (msg: Message & { channelId: string }) => {
      if (msg.channelId === activeChannelId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleTyping = ({
      userId,
      isTyping,
    }: {
      userId: string;
      channelId: string;
      isTyping: boolean;
    }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping && userId !== currentUserId) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    };

    socket.on("channel:message", handleMessage);
    socket.on("channel:typing", handleTyping);

    const handleReaction = ({
      messageId,
      reactions,
    }: {
      messageId: string;
      reactions: Reaction[];
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      );
    };

    socket.on("channel:reaction", handleReaction);

    return () => {
      cancelled = true;
      socket.off("channel:message", handleMessage);
      socket.off("channel:typing", handleTyping);
      socket.off("channel:reaction", handleReaction);
      socket.emit("channel:leave", activeChannelId);
    };
  }, [socket, activeChannelId, currentUserId]);

  // Join DM room when active DM changes
  useEffect(() => {
    if (!socket || !activeDMUserId) return;

    let cancelled = false;
    setMessages([]);
    setTypingUsers(new Set());

    // Fetch message history from the database
    fetch(`/api/chat/dms/${activeDMUserId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.messages) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});

    socket.emit("dm:join", activeDMUserId);

    const handleMessage = (msg: Message & { conversationId: string }) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping && userId !== currentUserId) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    };

    socket.on("dm:message", handleMessage);
    socket.on("dm:typing", handleTyping);

    const handleReaction = ({
      messageId,
      reactions,
    }: {
      messageId: string;
      reactions: Reaction[];
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      );
    };

    socket.on("dm:reaction", handleReaction);

    return () => {
      cancelled = true;
      socket.off("dm:message", handleMessage);
      socket.off("dm:typing", handleTyping);
      socket.off("dm:reaction", handleReaction);
    };
  }, [socket, activeDMUserId, currentUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    if (mode === "channels" && activeChannelId) {
      socket.emit("channel:message", {
        channelId: activeChannelId,
        content: input,
        replyToId: replyTo?.id,
      });
    } else if (mode === "dms" && activeDMUserId) {
      socket.emit("dm:message", {
        otherUserId: activeDMUserId,
        content: input,
        replyToId: replyTo?.id,
      });
    }

    setInput("");
    setReplyTo(null);
  }

  function handleReact(messageId: string, emoji: string) {
    if (!socket) return;
    setReactionPickerFor(null);

    if (mode === "channels" && activeChannelId) {
      socket.emit("channel:react", {
        channelId: activeChannelId,
        messageId,
        emoji,
      });
    } else if (mode === "dms" && activeDMUserId) {
      socket.emit("dm:react", {
        otherUserId: activeDMUserId,
        messageId,
        emoji,
      });
    }
  }

  function handleReply(msg: Message) {
    setReplyTo(msg);
    // Focus the input
    const inputEl = document.querySelector<HTMLInputElement>(
      'input[placeholder^="Message"], input[placeholder^="Type"]',
    );
    inputEl?.focus();
  }

  function handleTypingChange(value: string) {
    setInput(value);
    if (!socket) return;

    if (mode === "channels" && activeChannelId) {
      socket.emit("channel:typing", {
        channelId: activeChannelId,
        isTyping: value.length > 0,
      });
    } else if (mode === "dms" && activeDMUserId) {
      socket.emit("dm:typing", {
        otherUserId: activeDMUserId,
        isTyping: value.length > 0,
      });
    }
  }

  // Find active channel or DM info
  const activeChannel = chatServers
    .flatMap((s) => s.channels)
    .find((c) => c.id === activeChannelId);

  const activeDM = dmConversations.find((d) => d.otherUserId === activeDMUserId);
  const activeDMUser = tenantMembers.find((m) => m.userId === activeDMUserId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — server/channel list */}
      <div className="flex w-60 flex-col border-r border-border bg-card">
        {/* Mode toggle */}
        <div className="flex border-b border-border p-2">
          <button
            onClick={() => setMode("channels")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition ${
              mode === "channels"
                ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Hash className="h-4 w-4" />
            Channels
          </button>
          <button
            onClick={() => setMode("dms")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition ${
              mode === "dms"
                ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            DMs
          </button>
        </div>

        {/* Channel list */}
        {mode === "channels" ? (
          <div className="flex-1 overflow-y-auto p-2">
            {chatServers.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No chat servers yet. Ask an admin to create one.
              </p>
            ) : (
              chatServers.map((server) => (
                <div key={server.id} className="mb-4">
                  <p className="mb-1 px-2 text-xs font-semibold uppercase text-muted-foreground">
                    {server.name}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {server.channels.map((channel) => (
                      <li key={channel.id}>
                        <button
                          onClick={() => {
                            setActiveChannelId(channel.id);
                            setActiveDMUserId(null);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                            activeChannelId === channel.id
                              ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Hash className="h-3.5 w-3.5" />
                          {channel.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2">
            {/* Existing DMs */}
            {dmConversations.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 px-2 text-xs font-semibold uppercase text-muted-foreground">
                  Conversations
                </p>
                <ul className="flex flex-col gap-0.5">
                  {dmConversations.map((dm) => (
                    <li key={dm.id}>
                      <button
                        onClick={() => {
                          setActiveDMUserId(dm.otherUserId);
                          setActiveChannelId(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                          activeDMUserId === dm.otherUserId
                            ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="relative">
                          {dm.otherUserAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={dm.otherUserAvatarUrl}
                              alt=""
                              className="h-6 w-6 rounded-full"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--tenant-primary) text-xs font-medium text-white">
                              {dm.otherUserName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {onlineUsers.has(dm.otherUserId) && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-card bg-green-500" />
                          )}
                        </div>
                        <span className="truncate">{dm.otherUserName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* All members */}
            <div>
              <p className="mb-1 px-2 text-xs font-semibold uppercase text-muted-foreground">
                Members
              </p>
              <ul className="flex flex-col gap-0.5">
                {tenantMembers
                  .filter((m) => m.userId !== currentUserId)
                  .map((m) => (
                    <li key={m.userId}>
                      <button
                        onClick={() => {
                          setActiveDMUserId(m.userId);
                          setActiveChannelId(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                          activeDMUserId === m.userId
                            ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="relative">
                          {m.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.avatarUrl}
                              alt=""
                              className="h-6 w-6 rounded-full"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--tenant-primary) text-xs font-medium text-white">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {onlineUsers.has(m.userId) && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-card bg-green-500" />
                          )}
                        </div>
                        <span className="truncate">{m.name}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-12 items-center gap-2 border-b border-border px-4">
          {mode === "channels" && activeChannel ? (
            <>
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{activeChannel.name}</span>
            </>
          ) : mode === "dms" && (activeDM || activeDMUser) ? (
            <>
              <div className="relative">
                {(activeDM?.otherUserAvatarUrl ?? activeDMUser?.avatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeDM?.otherUserAvatarUrl ?? activeDMUser?.avatarUrl ?? ""}
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--tenant-primary) text-xs font-medium text-white">
                    {(activeDM?.otherUserName ?? activeDMUser?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                {activeDMUserId && onlineUsers.has(activeDMUserId) && (
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-card bg-green-500" />
                )}
              </div>
              <span className="font-semibold">
                {activeDM?.otherUserName ?? activeDMUser?.name}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Select a channel or DM to start chatting
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {mode === "channels" && activeChannel
                  ? `This is the beginning of #${activeChannel.name}`
                  : mode === "dms" && activeDMUserId
                    ? "Start your conversation!"
                    : "Select a channel or DM to start chatting"}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((msg) => {
                // Group reactions by emoji
                const reactionGroups: Record<
                  string,
                  { userIds: string[]; count: number }
                > = {};
                for (const r of msg.reactions ?? []) {
                  if (!reactionGroups[r.emoji]) {
                    reactionGroups[r.emoji] = { userIds: [], count: 0 };
                  }
                  reactionGroups[r.emoji].userIds.push(r.userId);
                  reactionGroups[r.emoji].count++;
                }
                const reactionEntries = Object.entries(reactionGroups);

                return (
                  <li
                    key={msg.id}
                    className="group relative flex gap-3 rounded-lg px-2 py-1 hover:bg-(--muted)/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--tenant-primary) text-sm font-medium text-white">
                      {msg.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Reply quote */}
                      {msg.replyTo && (
                        <div className="mb-1 flex items-center gap-1.5 border-l-2 border-(--tenant-primary)/40 pl-2 text-xs text-muted-foreground">
                          <Reply className="h-3 w-3 shrink-0" />
                          <span className="font-medium">
                            {msg.replyTo.userId === currentUserId
                              ? "You"
                              : msg.replyTo.userName}
                          </span>
                          <span className="truncate">
                            {msg.replyTo.content}
                          </span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">
                          {msg.userId === currentUserId ? "You" : msg.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString("en", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {msg.content}
                      </p>

                      {/* Reactions */}
                      {reactionEntries.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {reactionEntries.map(([emoji, info]) => {
                            const hasMine = info.userIds.includes(
                              currentUserId,
                            );
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReact(msg.id, emoji)}
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${
                                  hasMine
                                    ? "bg-(--tenant-primary)/20 text-(--tenant-primary) ring-1 ring-(--tenant-primary)/30"
                                    : "bg-muted text-muted-foreground hover:bg-(--muted)/70"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{info.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 opacity-0 shadow-sm transition group-hover:opacity-100">
                      {/* Quick reactions */}
                      {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(msg.id, emoji)}
                          className="flex h-7 w-7 items-center justify-center rounded text-base transition hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                      {/* More reactions */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setReactionPickerFor(
                              reactionPickerFor === msg.id ? null : msg.id,
                            )
                          }
                          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        {reactionPickerFor === msg.id && (
                          <div className="absolute right-0 top-8 z-10 flex gap-1 rounded-lg border border-border bg-card p-2 shadow-md">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReact(msg.id, emoji)}
                                className="flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-muted"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Reply */}
                      <button
                        onClick={() => handleReply(msg)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted"
                        title="Reply"
                      >
                        <Reply className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
              {typingUsers.size > 0 && (
                <li className="text-xs text-muted-foreground">
                  {typingUsers.size} {typingUsers.size === 1 ? "person is" : "people are"} typing...
                </li>
              )}
            </ul>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          {/* Reply preview */}
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <Reply className="h-3.5 w-3.5 shrink-0 text-(--tenant-primary)" />
                <div className="min-w-0">
                  <span className="font-medium text-(--tenant-primary)">
                    Replying to{" "}
                    {replyTo.userId === currentUserId ? "yourself" : replyTo.userName}
                  </span>
                  <p className="truncate text-muted-foreground">
                    {replyTo.content}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => handleTypingChange(e.target.value)}
              placeholder={
                mode === "channels" && activeChannel
                  ? `Message #${activeChannel.name}`
                  : mode === "dms" && activeDMUserId
                    ? "Type a message..."
                    : "Select a channel or DM first"
              }
              disabled={!activeChannelId && !activeDMUserId}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || (!activeChannelId && !activeDMUserId)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--tenant-primary) text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Members sidebar (channel mode only) */}
      {mode === "channels" && activeChannel && (
        <div className="hidden w-48 flex-col border-l border-border bg-card lg:flex">
          <div className="border-b border-border p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Members
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col gap-1">
              {chatServers
                .flatMap((s) => s.members)
                .filter(
                  (m, i, arr) =>
                    arr.findIndex((x) => x.userId === m.userId) === i,
                )
                .map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm"
                  >
                    <div className="relative">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatarUrl}
                          alt=""
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--tenant-primary) text-xs font-medium text-white">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {onlineUsers.has(m.userId) && (
                        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-card bg-green-500" />
                      )}
                    </div>
                    <span className="truncate text-muted-foreground">
                      {m.userId === currentUserId ? "You" : m.name}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
