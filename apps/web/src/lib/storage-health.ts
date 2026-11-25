import fs from "fs/promises";
import path from "path";
import { prisma } from "@coledia/db";
import { getStorageBase, resolveStoragePath } from "./storage";

/**
 * Upload persistence diagnostics.
 *
 * Uploads live on disk under STORAGE_PATH. In Dokploy that must be a mount
 * that survives redeploys AND Docker cleanups — use a Bind Mount (host path):
 * named "Volume Mounts" can be removed by `docker volume prune --all` while the
 * container is stopped during a redeploy.
 */

const SENTINEL = ".coledia-storage.json";
const UPLOAD_PREFIX = "/api/uploads/";

/** Mount point containing `dir` (Linux /proc/self/mountinfo); "/" = container FS; null = unknown. */
export async function getMountPoint(dir: string): Promise<string | null> {
  try {
    const info = await fs.readFile("/proc/self/mountinfo", "utf8");
    const points = info
      .split("\n")
      .map((l) => l.split(" ")[4])
      .filter((p): p is string => !!p);
    return (
      points
        .filter((p) => dir === p || dir.startsWith(p.endsWith("/") ? p : `${p}/`))
        .sort((a, b) => b.length - a.length)[0] ?? null
    );
  } catch {
    return null; // not Linux / not available
  }
}

export async function isWritable(dir: string): Promise<boolean> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.health-${process.pid}-${Date.now()}`);
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

export type StorageStatus = {
  storageBase: string;
  mountPoint: string | null;
  /** On a dedicated mount (survives redeploys). null = unknown (non-Linux). */
  persistent: boolean | null;
  writable: boolean;
};

export async function getStorageStatus(): Promise<StorageStatus> {
  const storageBase = getStorageBase();
  const [mountPoint, writable] = await Promise.all([getMountPoint(storageBase), isWritable(storageBase)]);
  return {
    storageBase,
    mountPoint,
    persistent: mountPoint === null ? null : mountPoint !== "/",
    writable,
  };
}

/** Storage-relative path from an "/api/uploads/…" URL (null for external URLs). */
export function uploadUrlToStoragePath(url: string | null | undefined): string | null {
  if (!url?.startsWith(UPLOAD_PREFIX)) return null;
  const rel = decodeURIComponent(url.slice(UPLOAD_PREFIX.length).split(/[?#]/)[0]);
  if (!rel || rel.split("/").some((s) => !s || s === "." || s === "..")) return null;
  return rel;
}

export type UploadRef = { category: string; id: string; storagePath: string };

/** Every DB reference to an uploaded file of this tenant. */
export async function collectUploadReferences(tenantId: string): Promise<UploadRef[]> {
  const take = 2000;
  const [docs, courses, chapters, posts, events, branding, profiles, templates, certificates] =
    await Promise.all([
      prisma.document.findMany({ where: { tenantId, storagePath: { not: null } }, select: { id: true, storagePath: true }, take }),
      prisma.course.findMany({ where: { tenantId, thumbnailUrl: { startsWith: UPLOAD_PREFIX } }, select: { id: true, thumbnailUrl: true }, take }),
      prisma.chapter.findMany({ where: { course: { tenantId }, videoUrl: { startsWith: UPLOAD_PREFIX } }, select: { id: true, videoUrl: true }, take }),
      prisma.post.findMany({ where: { tenantId, OR: [{ imageUrl: { startsWith: UPLOAD_PREFIX } }, { gifUrl: { startsWith: UPLOAD_PREFIX } }] }, select: { id: true, imageUrl: true, gifUrl: true }, take }),
      prisma.event.findMany({ where: { tenantId, OR: [{ thumbnailUrl: { startsWith: UPLOAD_PREFIX } }, { videoUrl: { startsWith: UPLOAD_PREFIX } }] }, select: { id: true, thumbnailUrl: true, videoUrl: true }, take }),
      prisma.branding.findUnique({ where: { tenantId }, select: { id: true, logoLightUrl: true, logoDarkUrl: true, faviconUrl: true } }),
      prisma.userProfile.findMany({ where: { tenantId, avatarUrl: { startsWith: UPLOAD_PREFIX } }, select: { id: true, avatarUrl: true }, take }),
      prisma.certificateTemplate.findMany({ where: { tenantId }, select: { id: true, backgroundImageUrl: true, logoUrl: true, signatureImageUrl: true }, take }),
      prisma.certificate.findMany({ where: { course: { tenantId }, certificateUrl: { startsWith: UPLOAD_PREFIX } }, select: { id: true, certificateUrl: true }, take }),
    ]);

  const refs: UploadRef[] = [];
  const add = (category: string, id: string, url: string | null | undefined) => {
    const storagePath = uploadUrlToStoragePath(url);
    if (storagePath) refs.push({ category, id, storagePath });
  };
  for (const d of docs ?? []) if (d.storagePath) refs.push({ category: "documents", id: d.id, storagePath: d.storagePath });
  for (const c of courses ?? []) add("courseThumbnails", c.id, c.thumbnailUrl);
  for (const c of chapters ?? []) add("chapterVideos", c.id, c.videoUrl);
  for (const p of posts ?? []) {
    add("postImages", p.id, p.imageUrl);
    add("postImages", p.id, p.gifUrl);
  }
  for (const e of events ?? []) {
    add("eventThumbnails", e.id, e.thumbnailUrl);
    add("eventThumbnails", e.id, e.videoUrl);
  }
  if (branding) {
    add("branding", branding.id, branding.logoLightUrl);
    add("branding", branding.id, branding.logoDarkUrl);
    add("branding", branding.id, branding.faviconUrl);
  }
  for (const p of profiles ?? []) add("avatars", p.id, p.avatarUrl);
  for (const t of templates ?? []) {
    add("certificateTemplates", t.id, t.backgroundImageUrl);
    add("certificateTemplates", t.id, t.logoUrl);
    add("certificateTemplates", t.id, t.signatureImageUrl);
  }
  for (const c of certificates ?? []) add("certificates", c.id, c.certificateUrl);
  return refs;
}

export type MissingReport = {
  checked: number;
  missing: number;
  byCategory: Record<string, { checked: number; missing: number }>;
  samples: UploadRef[];
};

/** Check every referenced upload exists on disk. */
export async function findMissingUploads(tenantId: string): Promise<MissingReport> {
  const refs = await collectUploadReferences(tenantId);
  const byCategory: MissingReport["byCategory"] = {};
  const missing: UploadRef[] = [];
  await Promise.all(
    refs.map(async (r) => {
      const cat = (byCategory[r.category] ??= { checked: 0, missing: 0 });
      cat.checked++;
      try {
        await fs.access(resolveStoragePath(r.storagePath));
      } catch {
        cat.missing++;
        missing.push(r);
      }
    }),
  );
  return { checked: refs.length, missing: missing.length, byCategory, samples: missing.slice(0, 50) };
}

/**
 * Boot check: write a sentinel file into the storage directory. If it's
 * missing while the DB already references uploads, the storage directory was
 * reset/replaced (e.g. a pruned Docker volume) — log loudly.
 * Returns true when a reset was detected.
 */
export async function checkStorageSentinel(tenantId: string): Promise<boolean> {
  const base = getStorageBase();
  const file = path.join(base, SENTINEL);
  try {
    await fs.access(file);
    return false;
  } catch {
    // first boot on this storage — fall through
  }

  const hasUploads = (await collectUploadReferences(tenantId)).length > 0;
  if (hasUploads) {
    console.error(
      `[storage] CRITICAL: ${base} has no ${SENTINEL} but the database references uploaded files — ` +
        "the storage directory was reset or replaced (e.g. a pruned Docker volume). " +
        "Use a Dokploy Bind Mount for STORAGE_PATH and restore from backup.",
    );
  }
  try {
    await fs.mkdir(base, { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({ tenantId, createdAt: new Date().toISOString(), resetDetected: hasUploads }, null, 2),
    );
  } catch (err) {
    console.error("[storage] Could not write storage sentinel:", err);
  }
  return hasUploads;
}
