"use client";

import { useState, useEffect, useRef } from "react";
import { Hash, Send, Users, MessageCircle, Plus, ChevronDown } from "lucide-react";
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

type Message = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
};

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

    setMessages([]);
    setTypingUsers(new Set());

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

    return () => {
      socket.off("channel:message", handleMessage);
      socket.off("channel:typing", handleTyping);
      socket.emit("channel:leave", activeChannelId);
    };
  }, [socket, activeChannelId, currentUserId]);

  // Join DM room when active DM changes
  useEffect(() => {
    if (!socket || !activeDMUserId) return;

    setMessages([]);
    setTypingUsers(new Set());

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

    return () => {
      socket.off("dm:message", handleMessage);
      socket.off("dm:typing", handleTyping);
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
      });
    } else if (mode === "dms" && activeDMUserId) {
      socket.emit("dm:message", {
        otherUserId: activeDMUserId,
        content: input,
      });
    }

    setInput("");
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
    <div className="flex h-full">
      {/* Sidebar — server/channel list */}
      <div className="flex w-60 flex-col border-r border-[var(--border)] bg-[var(--card)]">
        {/* Mode toggle */}
        <div className="flex border-b border-[var(--border)] p-2">
          <button
            onClick={() => setMode("channels")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition ${
              mode === "channels"
                ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            <Hash className="h-4 w-4" />
            Channels
          </button>
          <button
            onClick={() => setMode("dms")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition ${
              mode === "dms"
                ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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
              <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
                No chat servers yet. Ask an admin to create one.
              </p>
            ) : (
              chatServers.map((server) => (
                <div key={server.id} className="mb-4">
                  <p className="mb-1 px-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
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
                              ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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
                <p className="mb-1 px-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
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
                            ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-xs font-medium text-white">
                              {dm.otherUserName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {onlineUsers.has(dm.otherUserId) && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[var(--card)] bg-green-500" />
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
              <p className="mb-1 px-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
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
                            ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-xs font-medium text-white">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {onlineUsers.has(m.userId) && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[var(--card)] bg-green-500" />
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
        <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-4">
          {mode === "channels" && activeChannel ? (
            <>
              <Hash className="h-4 w-4 text-[var(--muted-foreground)]" />
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
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-xs font-medium text-white">
                    {(activeDM?.otherUserName ?? activeDMUser?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                {activeDMUserId && onlineUsers.has(activeDMUserId) && (
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[var(--card)] bg-green-500" />
                )}
              </div>
              <span className="font-semibold">
                {activeDM?.otherUserName ?? activeDMUser?.name}
              </span>
            </>
          ) : (
            <span className="text-sm text-[var(--muted-foreground)]">
              Select a channel or DM to start chatting
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                {mode === "channels" && activeChannel
                  ? `This is the beginning of #${activeChannel.name}`
                  : mode === "dms" && activeDMUserId
                    ? "Start your conversation!"
                    : "Select a channel or DM to start chatting"}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((msg) => (
                <li key={msg.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-sm font-medium text-white">
                    {msg.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {msg.userId === currentUserId ? "You" : msg.userName}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {new Date(msg.createdAt).toLocaleTimeString("en", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--foreground)]">{msg.content}</p>
                  </div>
                </li>
              ))}
              {typingUsers.size > 0 && (
                <li className="text-xs text-[var(--muted-foreground)]">
                  {typingUsers.size} {typingUsers.size === 1 ? "person is" : "people are"} typing...
                </li>
              )}
            </ul>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-4">
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
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || (!activeChannelId && !activeDMUserId)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Members sidebar (channel mode only) */}
      {mode === "channels" && activeChannel && (
        <div className="hidden w-48 flex-col border-l border-[var(--border)] bg-[var(--card)] lg:flex">
          <div className="border-b border-[var(--border)] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
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
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-xs font-medium text-white">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {onlineUsers.has(m.userId) && (
                        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[var(--card)] bg-green-500" />
                      )}
                    </div>
                    <span className="truncate text-[var(--muted-foreground)]">
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
