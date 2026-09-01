import { createServer } from "http";
import { Server } from "socket.io";

/**
 * Coledia Realtime Service — Socket.io
 *
 * Handles: chat messages, typing, presence, stream chat, live indicators.
 * Authenticated via session token. Rooms scoped by tenantId + resource id.
 *
 * Phase 6 implementation — this is a placeholder that starts the server.
 */

const PORT = parseInt(process.env.REALTIME_PORT ?? "3001", 10);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    credentials: true,
  },
});

// TODO: Phase 6 — implement authentication middleware
// io.use(async (socket, next) => {
//   const token = socket.handshake.auth.token;
//   // Verify Better-Auth session, attach userId + tenantId
//   next();
// });

io.on("connection", (socket) => {
  console.log(`[realtime] Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`[realtime] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] Socket.io server running on port ${PORT}`);
});
