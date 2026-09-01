import type { Locale } from "./config";

const messageCache = new Map<Locale, Record<string, unknown>>();

export async function getMessages(locale: Locale) {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!;
  }

  const mod = await import(`./messages/${locale}.json`);
  const messages = mod.default as Record<string, unknown>;
  messageCache.set(locale, messages);
  return messages;
}
