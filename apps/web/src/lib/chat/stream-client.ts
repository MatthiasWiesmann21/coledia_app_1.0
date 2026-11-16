"use client";

/**
 * One shared EventSource per browser tab for /api/chat/stream, used by the
 * chat UI and the notification bell. Reconnects with backoff; listeners for
 * "reconnected" can refetch to fill gaps after a dropped connection.
 */

type Handler = (data: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

const EVENTS = [
  "ready",
  "message:new",
  "message:updated",
  "reaction:updated",
  "read:updated",
  "typing",
  "presence",
  "conversation:new",
  "rooms:changed",
  "notification:new",
] as const;

const handlers = new Map<string, Set<Handler>>();
let source: EventSource | null = null;
let retry = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let everConnected = false;

function emit(event: string, data: unknown) {
  handlers.get(event)?.forEach((h) => {
    try {
      h(data);
    } catch (err) {
      console.error("[chat-stream] handler error", err);
    }
  });
}

function connect() {
  if (typeof window === "undefined" || source) return;
  const es = new EventSource("/api/chat/stream");
  source = es;

  for (const event of EVENTS) {
    es.addEventListener(event, (e) => {
      let data: unknown = null;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        return;
      }
      if (event === "ready") {
        retry = 0;
        if (everConnected) emit("reconnected", data);
        everConnected = true;
      }
      emit(event, data);
    });
  }

  es.onerror = () => {
    // Let the browser retry transient errors; rebuild if it gave up.
    if (es.readyState !== EventSource.CLOSED) return;
    es.close();
    if (source === es) source = null;
    if (handlers.size === 0 || reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * 2 ** retry++);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
}

function maybeDisconnect() {
  const active = [...handlers.values()].some((s) => s.size > 0);
  if (!active && source) {
    source.close();
    source = null;
    everConnected = false;
  }
}

/** Subscribe to a stream event; returns an unsubscribe function. */
export function onStreamEvent(event: string, handler: Handler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  connect();
  return () => {
    handlers.get(event)?.delete(handler);
    if (handlers.get(event)?.size === 0) handlers.delete(event);
    maybeDisconnect();
  };
}
