import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { requireAdminAction } from "@/lib/guards";
import { getStorageBase, isStoragePathAbsolute, resolveStoragePath } from "@/lib/storage";

/**
 * GET /api/storage/health — admin-only diagnostics for upload persistence.
 * Reports whether the storage base sits on a mounted volume (survives
 * redeploys), whether it is writable, and which of this tenant's documents
 * are missing on disk.
 */
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await requireAdminAction());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = getStorageBase();

  // Linux only: find the mount point that contains the storage base. "/" means
  // the container's own (ephemeral) filesystem — no volume is mounted.
  let mountPoint: string | null = null;
  try {
    const info = await fs.readFile("/proc/self/mountinfo", "utf8");
    const points = info
      .split("\n")
      .map((l) => l.split(" ")[4])
      .filter((p): p is string => !!p);
    mountPoint =
      points
        .filter((p) => base === p || base.startsWith(p.endsWith("/") ? p : `${p}/`))
        .sort((a, b) => b.length - a.length)[0] ?? null;
  } catch {
    // not Linux / not available
  }

  let writable = false;
  try {
    await fs.mkdir(base, { recursive: true });
    const probe = path.join(base, `.health-${Date.now()}`);
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe);
    writable = true;
  } catch {
    // reported below
  }

  const docs = await prisma.document.findMany({
    where: { tenantId, storagePath: { not: null } },
    select: { id: true, name: true, storagePath: true },
    take: 500,
  });
  const missing: { id: string; name: string }[] = [];
  for (const d of docs) {
    try {
      await fs.access(resolveStoragePath(d.storagePath!));
    } catch {
      missing.push({ id: d.id, name: d.name });
    }
  }

  const persistent = mountPoint !== null && mountPoint !== "/";
  return NextResponse.json({
    storageBase: base,
    storagePathAbsolute: isStoragePathAbsolute(),
    mountPoint,
    persistent,
    writable,
    documentsChecked: docs.length,
    documentsMissing: missing.length,
    missing: missing.slice(0, 50),
    hint: persistent
      ? "Storage is on a mounted volume and survives redeploys."
      : "Storage is NOT on a mounted volume — uploads are lost on redeploy. Add a Dokploy volume mount whose mount path equals STORAGE_PATH.",
  });
}
