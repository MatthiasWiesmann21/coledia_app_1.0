"use client";

import { io, Socket } from "socket.io-client";
import { getRealtimeToken } from "./realtime-actions";

let socket: Socket | null = null;

export function getSocket(userId: string, tenantId: string): Socket {
  if (socket?.connected) return socket;

  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001";

  socket = io(realtimeUrl, {
    // The realtime service identifies the user from a signed token only;
    // userId/tenantId are kept for backwards compatibility but not trusted.
    auth: (cb) => {
      getRealtimeToken()
        .then((token) => cb({ token, userId, tenantId }))
        .catch(() => cb({ userId, tenantId }));
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
