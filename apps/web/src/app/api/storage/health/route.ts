import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/guards";
import { isStoragePathAbsolute } from "@/lib/storage";
import { findMissingUploads, getStorageStatus } from "@/lib/storage-health";

/**
 * GET /api/storage/health — admin-only diagnostics for upload persistence.
 * Reports whether the storage base sits on a mounted volume (survives
 * redeploys), whether it is writable, and which of this tenant's uploaded
 * files (documents, thumbnails, post images, logos, avatars, certificates)
 * are referenced in the DB but missing on disk.
 */
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await requireAdminAction());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [status, report] = await Promise.all([getStorageStatus(), findMissingUploads(tenantId)]);

  return NextResponse.json({
    ...status,
    storagePathAbsolute: isStoragePathAbsolute(),
    filesChecked: report.checked,
    filesMissing: report.missing,
    byCategory: report.byCategory,
    missing: report.samples,
    hint:
      status.persistent === false
        ? "Storage is NOT on a mounted volume — uploads are lost on redeploy. Add a Dokploy Bind Mount whose container path equals STORAGE_PATH."
        : report.missing > 0
          ? "Files referenced in the database are missing on disk — the storage directory was likely reset (e.g. a pruned Docker named volume). Switch to a Bind Mount and restore from backup."
          : "Storage is on a mounted volume and all referenced files exist.",
  });
}
