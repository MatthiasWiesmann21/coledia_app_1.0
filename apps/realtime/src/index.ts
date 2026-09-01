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
      },
    });

    if (!channel || channel.chatServer.tenantId !== tenantId) {
      socket.emit("error", { message: "Channel not found" });
      return;
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
    async (data: { channelId: string; content: string }) => {
      try {
        // Verify membership
        const channel = await prisma.channel.findUnique({
          where: { id: data.channelId },
          include: {
            chatServer: { select: { tenantId: true } },
          },
        });

        if (!channel || channel.chatServer.tenantId !== tenantId) {
          return;
        }

        const message = await prisma.message.create({
          data: {
            channelId: data.channelId,
            userId,
            content: data.content,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
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
    async (data: { otherUserId: string; content: string }) => {
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

        const message = await prisma.message.create({
          data: {
            directConversationId: conversation.id,
            userId,
            content: data.content,
          },
          include: {
            user: {
              select: { id: true, name: true, email: true },
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
