import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { readFile } from "@/lib/storage";
import { getMimeType } from "@/lib/storage";
import { isAdminRole } from "@/lib/guards";
import { canViewDocument } from "@/lib/document-access";

/** GET /api/documents/[id]/download — download a document file */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = getTenantId();

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Admins can download any document of their tenant
  const isAdmin = isAdminRole(membership.role);

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
    include: { userGroups: { select: { id: true } } },
  });

  if (!document || !document.storagePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!isAdmin && !(await canViewDocument(session.user.id, tenantId, document))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(document.storagePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const contentType = document.mimeType ?? getMimeType(document.name);

  // Return with proper Content-Disposition (RFC 5987)
  const encodedFilename = encodeURIComponent(document.name).replace(
    /['()]/g,
    escape,
  );
  const contentDisposition = `attachment; filename="${document.name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodedFilename}`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Content-Length": String(fileBuffer.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
