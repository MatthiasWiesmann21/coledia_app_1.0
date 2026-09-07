import crypto from "crypto";
import { prisma } from "@coledia/db";

/**
 * API key generation + hashing.
 *
 * Keys are shown once at creation time and stored as a SHA-256 hash.
 * Lookup is by hash; the raw key never leaves the request that created it.
 */

const PREFIX = "col_";

/** Generate a new raw API key (shown once to the user). */
export function generateApiKey(): string {
  return PREFIX + crypto.randomBytes(24).toString("hex");
}

/** Hash a raw API key for storage. */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Verify a raw key against the stored hash and return the ApiKey row. */
export async function verifyApiKey(rawKey: string) {
  if (!rawKey.startsWith(PREFIX)) return null;
  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { tenant: true },
  });
  if (!apiKey) return null;

  // Update last used (fire-and-forget)
  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return apiKey;
}
