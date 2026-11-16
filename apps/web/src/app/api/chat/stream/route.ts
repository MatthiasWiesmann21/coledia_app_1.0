import { requireMember } from "@/lib/guards";
import { accessibleRoomKeys } from "@/lib/chat/access";
import { onlineUserIds, presenceConnect, subscribe, type BusMessage } from "@/lib/chat/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

/**
 * GET /api/chat/stream — Server-Sent Events for chat + notifications.
 * Subscribes to every room the member can read, their personal topic and the
 * tenant topic (presence, channel list changes).
 */
export async function GET(request: Request) {
  let ctx: Awaited<ReturnType<typeof requireMember>>;
  try {
    ctx = await requireMember();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const unsubscribers = new Map<string, () => void>();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let leavePresence: (() => void) | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const listen = (topic: string) => {
        if (unsubscribers.has(topic)) return;
        unsubscribers.set(topic, subscribe(topic, onMessage));
      };

      const syncRooms = async () => {
        const rooms = new Set(await accessibleRoomKeys(ctx));
        for (const [topic, off] of unsubscribers) {
          if ((topic.startsWith("channel:") || topic.startsWith("dm:")) && !rooms.has(topic)) {
            off();
            unsubscribers.delete(topic);
          }
        }
        for (const r of rooms) listen(r);
      };

      function onMessage(msg: BusMessage) {
        if (msg.event === "conversation:new" || msg.event === "rooms:changed") {
          void syncRooms().then(() => send(msg.event, msg.data));
          return;
        }
        send(msg.event, msg.data);
      }

      listen(`user:${ctx.userId}`);
      listen("tenant");
      await syncRooms();
      leavePresence = presenceConnect(ctx.userId);

      write("retry: 3000\n\n");
      send("ready", { online: onlineUserIds() });
      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    for (const off of unsubscribers.values()) off();
    unsubscribers.clear();
    leavePresence?.();
  }
  request.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
