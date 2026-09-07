import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { readFile } from "@/lib/storage";
import { getMimeType } from "@/lib/file-utils";

/**
 * GET /api/uploads/[...path] — serve tenant-scoped uploaded files.
 * Path format: {tenantId}/{category}/{filename}
 * Requires an authenticated session; cross-tenant access is rejected.
 * Use ?download=1 to force a download (Content-Disposition: attachment).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;

  // Reject traversal and malformed paths
  if (
    !segments?.length ||
    segments.some((s) => !s || s === "." || s === ".." || s.includes("\\"))
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Tenant isolation: the first segment must be the current tenant
  if (segments[0] !== getTenantId()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storagePath = segments.join("/");

  try {
    const buffer = await readFile(storagePath);
    const filename = path.basename(storagePath);
    const mimeType = getMimeType(filename);
    const download = request.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": mimeType,
        "content-length": String(buffer.length),
        "cache-control": "private, max-age=3600",
        ...(download
          ? {
              "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
            }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}