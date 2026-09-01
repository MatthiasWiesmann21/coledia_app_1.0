"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(userId: string, tenantId: string): Socket {
  if (socket?.connected) return socket;

  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001";

  socket = io(realtimeUrl, {
    auth: {
      userId,
      tenantId,
    },
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
