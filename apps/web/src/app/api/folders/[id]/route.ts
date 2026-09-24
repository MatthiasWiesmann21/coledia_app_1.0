import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { deleteFile } from "@/lib/storage";
import { isAdminRole, assertTenantUserGroups, getMyUserGroupIds } from "@/lib/guards";
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
  if (!membership || !isAdminRole(membership.role)) {
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

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Non-admins only see visible, published folders they have group access to
  if (!isAdminRole(membership.role)) {
    const myGroups = await getMyUserGroupIds(session.user.id, tenantId);
    const groupOk =
      folder.userGroups.length === 0 || folder.userGroups.some((g) => myGroups.includes(g.id));
    if (!folder.visible || !folder.published || !groupOk) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
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
  const parsed = updateFolderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.folder.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const { userGroupIds, ...rest } = parsed.data;
  try {
    await assertTenantUserGroups(admin.tenantId, userGroupIds);
  } catch {
    return NextResponse.json({ error: "Invalid user group" }, { status: 400 });
  }

  const folder = await prisma.folder.update({
    where: { id, tenantId: admin.tenantId },
    data: {
      ...rest,
      ...(userGroupIds !== undefined
        ? { userGroups: { set: userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
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

  // Recursively collect the folder subtree (parent first) and its documents
  const folderIds: string[] = [];
  const storagePathsToDelete: string[] = [];
  async function collect(folderId: string) {
    folderIds.push(folderId);
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
      await collect(child.id);
    }
  }
  await collect(id);

  // Delete DB rows: documents first (their FK would otherwise be set to NULL),
  // then folders deepest-first (the parent relation has no DB cascade)
  await prisma.$transaction([
    prisma.document.deleteMany({ where: { folderId: { in: folderIds }, tenantId } }),
    ...[...folderIds].reverse().map((fid) =>
      prisma.folder.deleteMany({ where: { id: fid, tenantId } }),
    ),
  ]);

  // Delete files from disk once the DB is consistent
  for (const sp of storagePathsToDelete) {
    await deleteFile(sp);
  }

  return NextResponse.json({ success: true });
}
