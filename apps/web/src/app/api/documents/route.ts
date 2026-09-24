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
  const includeAll = searchParams.get("includeAll") === "true";

  // Check admin status
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  const isAdmin =
    membership && ["owner", "admin", "operator"].includes(membership.role);

  // Get user's group IDs for role-based filtering
  const userGroupIds = (
    await prisma.userGroupMember.findMany({
      where: { userId: session.user.id, userGroup: { tenantId } },
      select: { userGroupId: true },
    })
  ).map((m) => m.userGroupId);

  // Build where clause
  const where: any = {
    tenantId,
    folderId: folderId || null,
  };

  // userGroup filtering applies to everyone unless explicitly bypassed (admin manager)
  if (!includeAll) {
    where.OR = [
      { userGroups: { none: {} } },
      { userGroups: { some: { id: { in: userGroupIds } } } },
    ];
  }

  // visible/published filtering only for non-admins
  if (!isAdmin) {
    where.visible = true;
    where.published = true;
  }

  const documents = await prisma.document.findMany({
    where,
    include: { userGroups: { select: { id: true, name: true } } },
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
      userGroups: d.userGroups.map((g) => ({ id: g.id, name: g.name })),
      visible: d.visible,
      published: d.published,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}
