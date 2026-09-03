import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

/**
 * Coledia Realtime Service — Socket.io
 *
 * Handles: chat messages, typing, presence, stream chat, live indicators.
 * Authenticated via session token. Rooms scoped by tenantId + resource id.
 */

const prisma = new PrismaClient();

const PORT = parseInt(process.env.REALTIME_PORT ?? "3001", 10);
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: BETTER_AUTH_URL,
    credentials: true,
  },
});

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

function setUserOnline(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId)!.add(socketId);
  io.emit("presence:online", { userId });
}

function setUserOffline(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      onlineUsers.delete(userId);
      io.emit("presence:offline", { userId });
    }
  }
}

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token as string | undefined;
    const userId = socket.handshake.auth.userId as string | undefined;
    const tenantId = socket.handshake.auth.tenantId as string | undefined;

    if (!userId || !tenantId) {
      return next(new Error("Missing userId or tenantId"));
    }

    // Verify the user is a member of the tenant
    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: { userId, tenantId },
      },
    });

    if (!membership) {
      return next(new Error("Not a member of this tenant"));
    }

    // Attach to socket
    (socket as any).userId = userId;
    (socket as any).tenantId = tenantId;
    (socket as any).membershipRole = membership.role;

    next();
  } catch (err) {
    next(err as Error);
  }
});

io.on("connection", (socket) => {
  const userId = (socket as any).userId as string;
  const tenantId = (socket as any).tenantId as string;

  console.log(`[realtime] Client connected: ${socket.id} (user: ${userId})`);

  // Join tenant room
  socket.join(`tenant:${tenantId}`);

  // Mark user online
  setUserOnline(userId, socket.id);

  // ─── Channel chat ──────────────────────────────────────────

  socket.on("channel:join", async (channelId: string) => {
    // Verify the user is a member of the channel's chat server
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        chatServer: { select: { tenantId: true } },
        userGroups: { select: { id: true } },
      },
    });

    if (!channel || channel.chatServer.tenantId !== tenantId) {
      socket.emit("error", { message: "Channel not found" });
      return;
    }

    // Enforce channel-level user group access
    if (channel.userGroups.length > 0) {
      const membership = await prisma.userGroupMember.findFirst({
        where: {
          userId,
          userGroupId: { in: channel.userGroups.map((g) => g.id) },
        },
      });
      if (!membership) {
        socket.emit("error", { message: "No access to this channel" });
        return;
      }
    }

    socket.join(`channel:${channelId}`);

    // Auto-add as channel member if not already
    await prisma.channelMember.upsert({
      where: {
        userId_channelId: { userId, channelId },
      },
      update: {},
      create: { userId, channelId },
    });
  });

  socket.on("channel:leave", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  socket.on(
    "channel:message",
    async (data: { channelId: string; content: string; replyToId?: string }) => {
      try {
        // Verify membership and channel user group access
        const channel = await prisma.channel.findUnique({
          where: { id: data.channelId },
          include: {
            chatServer: { select: { tenantId: true } },
            userGroups: { select: { id: true } },
          },
        });

        if (!channel || channel.chatServer.tenantId !== tenantId) {
          return;
        }

        if (channel.userGroups.length > 0) {
          const membership = await prisma.userGroupMember.findFirst({
            where: {
              userId,
              userGroupId: { in: channel.userGroups.map((g) => g.id) },
            },
          });
          if (!membership) {
            return;
          }
        }

        // Validate reply target belongs to same channel
        let replyToId: string | undefined;
        if (data.replyToId) {
          const replyTarget = await prisma.message.findUnique({
            where: { id: data.replyToId },
            select: { channelId: true },
          });
          if (replyTarget && replyTarget.channelId === data.channelId) {
            replyToId = data.replyToId;
          }
        }

        const message = await prisma.message.create({
          data: {
            channelId: data.channelId,
            userId,
            content: data.content,
            replyToId: replyToId ?? null,
          },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                userId: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        });

        io.to(`channel:${data.channelId}`).emit("channel:message", {
          id: message.id,
          channelId: message.channelId,
          userId: message.userId,
          userName: message.user.name ?? message.user.email,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          replyTo: message.replyTo
            ? {
                id: message.replyTo.id,
                content: message.replyTo.content,
                userId: message.replyTo.userId,
                userName:
                  message.replyTo.user.name ?? message.replyTo.user.email,
              }
            : null,
          reactions: [],
        });
      } catch (err) {
        console.error("[realtime] channel:message error:", err);
      }
    },
  );

  socket.on(
    "channel:typing",
    (data: { channelId: string; isTyping: boolean }) => {
      socket.to(`channel:${data.channelId}`).emit("channel:typing", {
        userId,
        channelId: data.channelId,
        isTyping: data.isTyping,
      });
    },
  );

  // ─── Direct messages ───────────────────────────────────────

  socket.on("dm:join", async (otherUserId: string) => {
    // Find or create direct conversation
    // Ensure consistent ordering: user1Id < user2Id
    const [user1Id, user2Id] =
      userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

    const conversation = await prisma.directConversation.upsert({
      where: {
        user1Id_user2Id: { user1Id, user2Id },
      },
      update: {},
      create: { tenantId, user1Id, user2Id },
    });

    (socket as any).dmConversationId = conversation.id;
    socket.join(`dm:${conversation.id}`);
  });

  socket.on(
    "dm:message",
    async (data: { otherUserId: string; content: string; replyToId?: string }) => {
      try {
        const [user1Id, user2Id] =
          userId < data.otherUserId
            ? [userId, data.otherUserId]
            : [data.otherUserId, userId];

        const conversation = await prisma.directConversation.upsert({
          where: {
            user1Id_user2Id: { user1Id, user2Id },
          },
          update: {},
          create: { tenantId, user1Id, user2Id },
        });

        // Validate reply target belongs to same conversation
        let replyToId: string | undefined;
        if (data.replyToId) {
          const replyTarget = await prisma.message.findUnique({
            where: { id: data.replyToId },
            select: { directConversationId: true },
          });
          if (
            replyTarget &&
            replyTarget.directConversationId === conversation.id
          ) {
            replyToId = data.replyToId;
          }
        }

        const message = await prisma.message.create({
          data: {
            directConversationId: conversation.id,
            userId,
            content: data.content,
            replyToId: replyToId ?? null,
          },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                userId: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        });

        io.to(`dm:${conversation.id}`).emit("dm:message", {
          id: message.id,
          conversationId: conversation.id,
          userId: message.userId,
          userName: message.user.name ?? message.user.email,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          replyTo: message.replyTo
            ? {
                id: message.replyTo.id,
                content: message.replyTo.content,
                userId: message.replyTo.userId,
                userName:
                  message.replyTo.user.name ?? message.replyTo.user.email,
              }
            : null,
          reactions: [],
        });
      } catch (err) {
        console.error("[realtime] dm:message error:", err);
      }
    },
  );

  socket.on("dm:typing", (data: { otherUserId: string; isTyping: boolean }) => {
    const [user1Id, user2Id] =
      userId < data.otherUserId
        ? [userId, data.otherUserId]
        : [data.otherUserId, userId];

    // We need to find the conversation to emit to the right room
    // But typing is ephemeral — just emit to the other user's personal room
    socket.to(`user:${data.otherUserId}`).emit("dm:typing", {
      userId,
      isTyping: data.isTyping,
    });
  });

  // ─── Reactions ──────────────────────────────────────────────

  socket.on(
    "channel:react",
    async (data: { channelId: string; messageId: string; emoji: string }) => {
      try {
        // Verify channel access
        const channel = await prisma.channel.findUnique({
          where: { id: data.channelId },
          include: {
            chatServer: { select: { tenantId: true } },
            userGroups: { select: { id: true } },
          },
        });

        if (!channel || channel.chatServer.tenantId !== tenantId) return;

        if (channel.userGroups.length > 0) {
          const membership = await prisma.userGroupMember.findFirst({
            where: {
              userId,
              userGroupId: { in: channel.userGroups.map((g) => g.id) },
            },
          });
          if (!membership) return;
        }

        // Toggle reaction
        const existing = await prisma.messageReaction.findUnique({
          where: {
            messageId_userId_emoji: {
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
            },
          },
        });

        if (existing) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.messageReaction.create({
            data: {
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
            },
          });
        }

        // Broadcast updated reaction list for this message
        const reactions = await prisma.messageReaction.findMany({
          where: { messageId: data.messageId },
          select: { userId: true, emoji: true },
        });

        io.to(`channel:${data.channelId}`).emit("channel:reaction", {
          messageId: data.messageId,
          reactions: reactions.map((r) => ({ userId: r.userId, emoji: r.emoji })),
        });
      } catch (err) {
        console.error("[realtime] channel:react error:", err);
      }
    },
  );

  socket.on(
    "dm:react",
    async (data: { otherUserId: string; messageId: string; emoji: string }) => {
      try {
        const [user1Id, user2Id] =
          userId < data.otherUserId
            ? [userId, data.otherUserId]
            : [data.otherUserId, userId];

        const conversation = await prisma.directConversation.findUnique({
          where: { user1Id_user2Id: { user1Id, user2Id } },
        });

        if (!conversation || conversation.tenantId !== tenantId) return;

        // Verify message belongs to this conversation
        const msg = await prisma.message.findUnique({
          where: { id: data.messageId },
          select: { directConversationId: true },
        });
        if (!msg || msg.directConversationId !== conversation.id) return;

        // Toggle reaction
        const existing = await prisma.messageReaction.findUnique({
          where: {
            messageId_userId_emoji: {
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
            },
          },
        });

        if (existing) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.messageReaction.create({
            data: {
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
            },
          });
        }

        // Broadcast updated reaction list
        const reactions = await prisma.messageReaction.findMany({
          where: { messageId: data.messageId },
          select: { userId: true, emoji: true },
        });

        io.to(`dm:${conversation.id}`).emit("dm:reaction", {
          messageId: data.messageId,
          reactions: reactions.map((r) => ({ userId: r.userId, emoji: r.emoji })),
        });
      } catch (err) {
        console.error("[realtime] dm:react error:", err);
      }
    },
  );

  // Join personal room for DMs and presence
  socket.join(`user:${userId}`);

  // ─── Presence ──────────────────────────────────────────────

  socket.on("presence:request", () => {
    const online: string[] = [];
    onlineUsers.forEach((_, id) => online.push(id));
    socket.emit("presence:list", { online });
  });

  // ─── Disconnect ────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`[realtime] Client disconnected: ${socket.id}`);
    setUserOffline(userId, socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] Socket.io server running on port ${PORT}`);
});
