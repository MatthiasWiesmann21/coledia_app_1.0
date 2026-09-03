import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";

/** GET /api/documents — list documents (filtered by visibility for non-admins) */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantId();
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") || null;

  // Check admin status
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  const isAdmin =
    membership && ["owner", "admin", "operator"].includes(membership.role);

  // Build where clause
  const where: any = {
    tenantId,
    folderId: folderId || null,
  };

  if (!isAdmin) {
    where.visible = true;
    where.published = true;
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    documents: documents.map((d) => ({
      id: d.id,
      name: d.name,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize?.toString() ?? "0",
      mimeType: d.mimeType,
      fileType: d.fileType,
      folderId: d.folderId,
      visible: d.visible,
      published: d.published,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}
