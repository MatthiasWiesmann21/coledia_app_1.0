import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { readFile } from "@/lib/storage";
import { getMimeType } from "@/lib/storage";

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

  // Check admin status (admins can download any document)
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  const isAdmin =
    membership && ["owner", "admin", "operator"].includes(membership.role);

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!document || !document.storagePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Non-admins: check visibility
  if (!isAdmin) {
    if (!document.visible || !document.published) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    // Check folder visibility chain
    if (document.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: document.folderId, visible: true, published: true },
      });
      if (!folder) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      // Check userGroup access if folder has one
      if (folder.userGroupId) {
        const groupMember = await prisma.userGroupMember.findUnique({
          where: {
            userGroupId_userId: {
              userGroupId: folder.userGroupId,
              userId: session.user.id,
            },
          },
        });
        if (!groupMember) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }
  }

  const fileBuffer = await readFile(document.storagePath);
  const contentType = document.mimeType ?? getMimeType(document.name);

  // Return with proper Content-Disposition (RFC 5987)
  const encodedFilename = encodeURIComponent(document.name).replace(
    /['()]/g,
    escape,
  );
  const contentDisposition = `attachment; filename="${document.name.replace(/[^\x00-\x7F]/g, "_")}"; filename*=UTF-8''${encodedFilename}`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Content-Length": document.fileSize?.toString() ?? "0",
    },
  });
}
