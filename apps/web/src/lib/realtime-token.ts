import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, HMAC-signed token that proves to the realtime service which
 * user (and tenant) opened a socket. The session cookie is httpOnly, so the
 * browser fetches this token from a server action instead.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 * The realtime service verifies it with the same REALTIME_INTERNAL_SECRET.
 */

export type RealtimeTokenPayload = { userId: string; tenantId: string; exp: number };

const TOKEN_TTL_SECONDS = 5 * 60;

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createRealtimeToken(
  userId: string,
  tenantId: string,
  secret: string,
  now: number = Date.now(),
): string {
  const payload: RealtimeTokenPayload = {
    userId,
    tenantId,
    exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function verifyRealtimeToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): RealtimeTokenPayload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as RealtimeTokenPayload;
    if (!payload.userId || !payload.tenantId || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
