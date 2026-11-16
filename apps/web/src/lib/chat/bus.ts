import { EventEmitter } from "events";

/**
 * In-process chat event bus. Every tenant runs in its own container with a
 * single Node process, so an EventEmitter is enough to fan out events to all
 * open SSE streams. (Running several replicas of one tenant would need a
 * shared pub/sub such as Redis instead.)
 *
 * Topics: `channel:<id>`, `dm:<id>`, `user:<id>` and `tenant` (presence,
 * channel list changes).
 */

export type BusMessage = { event: string; data: unknown };

type BusState = { emitter: EventEmitter; online: Map<string, number> };
const g = globalThis as unknown as { __coledia_chat_bus?: BusState };
const state: BusState =
  g.__coledia_chat_bus ??
  (g.__coledia_chat_bus = (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    return { emitter, online: new Map<string, number>() };
  })());

export function publish(topic: string, event: string, data: unknown): void {
  state.emitter.emit(topic, { event, data } satisfies BusMessage);
}

export function subscribe(topic: string, listener: (msg: BusMessage) => void): () => void {
  state.emitter.on(topic, listener);
  return () => state.emitter.off(topic, listener);
}

/** Track an open stream; publishes presence when the user comes online/offline. */
export function presenceConnect(userId: string): () => void {
  const count = (state.online.get(userId) ?? 0) + 1;
  state.online.set(userId, count);
  if (count === 1) publish("tenant", "presence", { userId, online: true });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const next = (state.online.get(userId) ?? 1) - 1;
    if (next <= 0) {
      state.online.delete(userId);
      publish("tenant", "presence", { userId, online: false });
    } else {
      state.online.set(userId, next);
    }
  };
}

export function onlineUserIds(): string[] {
  return [...state.online.keys()];
}
