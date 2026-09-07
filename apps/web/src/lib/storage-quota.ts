import { prisma } from "@coledia/db";
import { getCurrentPlanLimits } from "./plan";

/**
 * Tenant storage quota enforcement.
 *
 * Aggregates bytes used by the current tenant across:
 *  - Document.fileSize (Doc-Hub uploads)
 *  - DocumentVersion rows (fileUrl points into tenant storage)
 *  - On-disk files in uploads/{tenantId}/images, certificates, etc.
 *    (tracked via DB where possible; otherwise scanned on demand)
 *
 * Plan limits (from PLAN_FEATURES):
 *  - Starter: 1 GB
 *  - Club: 10 GB
 *  - Organization: unlimited (null)
 */

/** Sum of fileSize for all tenant documents (BigInt → number). */
async function documentBytes(tenantId: string): Promise<number> {
  const agg = await prisma.document.aggregate({
    where: { tenantId },
    _sum: { fileSize: true },
  });
  return Number(agg._sum.fileSize ?? 0n);
}

/** Bytes used by image/certificate/thumbnail uploads not tracked in Document rows.
 *  We approximate by scanning the tenant storage directory for non-document categories. */
async function mediaBytes(tenantId: string): Promise<number> {
  // We don't have DB rows for avatars/logos/thumbnails/certificates, so we scan disk.
  // This is acceptable because media uploads are infrequent compared to documents.
  const fs = await import("fs/promises");
  const path = await import("path");
  const { resolveStoragePath } = await import("./storage");

  const tenantRoot = resolveStoragePath(tenantId);
  let total = 0;
  const mediaCategories = [
    "images",
    "avatars",
    "certificates",
    "course-thumbnails",
    "post-images",
    "event-thumbnails",
    "videos",
  ];

  for (const cat of mediaCategories) {
    const dir = path.join(tenantRoot, cat);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        try {
          const stat = await fs.stat(path.join(dir, entry.name));
          total += stat.size;
        } catch {
          // file may have been removed concurrently
        }
      }
    } catch {
      // directory doesn't exist yet — nothing to count
    }
  }
  return total;
}

/** Total bytes currently used by the tenant. */
export async function getTenantStorageUsage(tenantId: string): Promise<number> {
  const [docs, media] = await Promise.all([
    documentBytes(tenantId),
    mediaBytes(tenantId),
  ]);
  return docs + media;
}

/** Returns { used, limit, ok, wouldExceed } for the current tenant + a pending upload. */
export async function checkStorageQuota(
  tenantId: string,
  incomingBytes: number,
): Promise<{
  used: number;
  limit: number | null;
  ok: boolean;
  wouldExceed: boolean;
}> {
  const { storageLimitBytes } = await getCurrentPlanLimits();
  const used = await getTenantStorageUsage(tenantId);
  const limit = storageLimitBytes;
  const wouldExceed = limit !== null && used + incomingBytes > limit;
  return { used, limit, ok: !wouldExceed, wouldExceed };
}

/** Throw-style helper for route handlers — returns an error message or null if OK. */
export async function assertStorageQuota(
  tenantId: string,
  incomingBytes: number,
): Promise<string | null> {
  const { ok, used, limit } = await checkStorageQuota(tenantId, incomingBytes);
  if (ok) return null;
  const usedMb = Math.round(used / (1024 * 1024));
  const limitMb = Math.round((limit ?? 0) / (1024 * 1024));
  return `Storage quota exceeded. Currently using ~${usedMb} MB of ${limitMb} MB. Delete unused files or upgrade your plan.`;
}
