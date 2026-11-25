import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { readFile } from "@/lib/storage";
import { getMimeType } from "@/lib/storage";
import { routeMember } from "@/lib/guards";
import { canViewDocument } from "@/lib/document-access";

/** GET /api/documents/[id]/download — download a document file */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await routeMember({ module: "documents" });
  if (member instanceof Response) return member;
  const { id } = await params;
  // Admins can download any document of their tenant
  const { tenantId, isAdmin, userId } = member;

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
    include: { userGroups: { select: { id: true } } },
  });

  if (!document || !document.storagePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!isAdmin && !(await canViewDocument(userId, tenantId, document))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(document.storagePath);
  } catch {
    // The DB row exists but the file is gone from disk — almost always uploads
    // stored on the ephemeral container filesystem and wiped by a redeploy.
    console.error(`[storage] document ${document.id} missing on disk: ${document.storagePath}`);
    return NextResponse.json(
      { error: "The file is missing from storage. Please re-upload it." },
      { status: 404 },
    );
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
