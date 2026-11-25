import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { routeMember } from "@/lib/guards";
import { readFile } from "@/lib/storage";
import { getMimeType } from "@/lib/file-utils";

/** Raster image / media types that are safe to render inline. Everything else downloads. */
const INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

/**
 * GET /api/uploads/[...path] — serve tenant-scoped uploaded files.
 * Path format: {tenantId}/{category}/{filename}
 * Requires membership in the current tenant; cross-tenant access is rejected.
 * Documents are never served here — they go through /api/documents/[id]/download
 * so visibility and user-group rules are enforced.
 * Use ?download=1 to force a download (Content-Disposition: attachment).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const member = await routeMember();
  if (member instanceof Response) return member;

  const { path: segments } = await params;

  // Reject traversal and malformed paths
  if (
    !segments?.length ||
    segments.some((s) => !s || s === "." || s === ".." || s.includes("\\"))
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Tenant isolation: the first segment must be the current tenant
  const { tenantId } = member;
  if (segments[0] !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Documents and chat attachments must go through their access-checked routes
  if (segments[1] === "documents" || segments[1] === "chat") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storagePath = segments.join("/");

  try {
    const buffer = await readFile(storagePath);
    const filename = path.basename(storagePath);
    const mimeType = getMimeType(filename);
    const inline =
      INLINE_TYPES.has(mimeType) && request.nextUrl.searchParams.get("download") !== "1";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": inline ? mimeType : "application/octet-stream",
        "content-length": String(buffer.length),
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self'; sandbox",
        "content-disposition": inline
          ? "inline"
          : `attachment; filename="${filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
