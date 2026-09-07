import crypto from "crypto";
import { prisma } from "@coledia/db";

/**
 * Webhook delivery service.
 *
 * - Finds active webhooks subscribed to an event for a tenant.
 * - Signs payloads with HMAC-SHA256 using the webhook secret.
 * - POSTs the payload with retries + exponential backoff.
 * - Failures are logged but never throw to the caller.
 */

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export type WebhookEvent =
  | "course.created"
  | "course.updated"
  | "course.deleted"
  | "post.created"
  | "post.updated"
  | "post.deleted"
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "user.enrolled"
  | "user.joined"
  | "user.removed"
  | "payment.succeeded"
  | "payment.refunded"
  | "certificate.issued";

function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/** Dispatch a webhook event to all active subscriber URLs for the tenant. */
export async function dispatchWebhook(opts: {
  tenantId: string;
  event: WebhookEvent | string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId: opts.tenantId, active: true },
    });

    const payload = JSON.stringify({
      event: opts.event,
      data: opts.data,
      timestamp: new Date().toISOString(),
    });

    await Promise.allSettled(
      webhooks
        .filter((w) => {
          const events = Array.isArray(w.events) ? w.events : [];
          return events.includes(opts.event) || events.includes("*");
        })
        .map((w) => deliverWithRetry(w.id, w.url, w.secret, payload)),
    );
  } catch (err) {
    console.error("[webhooks] dispatch failed:", err);
  }
}

/** Fire-and-forget wrapper for use in server actions. */
export function dispatchWebhookAsync(opts: Parameters<typeof dispatchWebhook>[0]): void {
  void dispatchWebhook(opts);
}

async function deliverWithRetry(
  webhookId: string,
  url: string,
  secret: string,
  body: string,
): Promise<void> {
  const signature = signPayload(secret, body);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": "coledia",
          "X-Webhook-Signature": signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return; // 2xx — success
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.warn(`[webhooks] ${webhookId} → ${res.status} (non-retryable)`);
        return;
      }
      // 5xx or 429 → retry
    } catch {
      // network error / abort → retry
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  console.warn(`[webhooks] ${webhookId} delivery failed after ${MAX_ATTEMPTS} attempts`);
}

/** Generate a new random webhook secret. */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString("hex");
}
