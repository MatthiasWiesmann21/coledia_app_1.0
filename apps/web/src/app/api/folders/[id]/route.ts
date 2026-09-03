import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { deleteFile } from "@/lib/storage";
import { z } from "zod";

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  visible: z.boolean().optional(),
  published: z.boolean().optional(),
  userGroupIds: z.array(z.string()).optional(),
});

async function requireAdmin(session: any) {
  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
    return null;
  }
  return { tenantId, membership };
}

/** GET /api/folders/[id] — get folder details */
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

  const folder = await prisma.folder.findFirst({
    where: { id, tenantId },
    include: {
      _count: { select: { documents: true, children: true } },
      userGroups: { select: { id: true, name: true } },
    },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  return NextResponse.json({
    folder: {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      userGroups: folder.userGroups.map((g) => ({ id: g.id, name: g.name })),
      visible: folder.visible,
      published: folder.published,
      fileCount: folder._count.documents,
      folderCount: folder._count.children,
      createdAt: folder.createdAt.toISOString(),
    },
  });
}

/** PATCH /api/folders/[id] — update folder (admin only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await requireAdmin(session);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateFolderSchema.parse(body);

  const { userGroupIds, ...rest } = parsed;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  const folder = await prisma.folder.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    folder: {
      id: folder.id,
      name: folder.name,
      visible: folder.visible,
      published: folder.published,
    },
  });
}

/** DELETE /api/folders/[id] — delete a folder and its contents (admin only) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await requireAdmin(session);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = getTenantId();

  // Verify folder belongs to tenant
  const folder = await prisma.folder.findFirst({
    where: { id, tenantId },
    include: { documents: true, children: true },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Recursively collect all document storage paths to delete
  const storagePathsToDelete: string[] = [];
  async function collectDocuments(folderId: string) {
    const docs = await prisma.document.findMany({
      where: { folderId, tenantId },
      select: { storagePath: true },
    });
    for (const doc of docs) {
      if (doc.storagePath) storagePathsToDelete.push(doc.storagePath);
    }
    const children = await prisma.folder.findMany({
      where: { parentId: folderId, tenantId },
      select: { id: true },
    });
    for (const child of children) {
      await collectDocuments(child.id);
    }
  }
  await collectDocuments(id);

  // Delete from disk
  for (const sp of storagePathsToDelete) {
    await deleteFile(sp);
  }

  // Delete from DB (cascades)
  await prisma.folder.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
