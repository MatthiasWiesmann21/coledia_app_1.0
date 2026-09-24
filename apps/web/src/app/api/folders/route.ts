import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { assertTenantUserGroups } from "@/lib/guards";
import { z } from "zod";

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().nullable().optional(),
  userGroupIds: z.array(z.string()).optional(),
  visible: z.boolean().optional(),
  published: z.boolean().optional(),
});

/** GET /api/folders — list folders (filtered by visibility for non-admins) */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantId();
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId") || null;
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
    parentId: parentId || null,
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

  const folders = await prisma.folder.findMany({
    where,
    include: {
      _count: {
        select: { documents: true, children: true },
      },
      userGroups: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      userGroups: f.userGroups.map((g) => ({ id: g.id, name: g.name })),
      visible: f.visible,
      published: f.published,
      fileCount: f._count.documents,
      folderCount: f._count.children,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
}

/** POST /api/folders — create a folder (admin only) */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createFolderSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = result.data;
  try {
    await assertTenantUserGroups(tenantId, parsed.userGroupIds);
  } catch {
    return NextResponse.json({ error: "Invalid user group" }, { status: 400 });
  }

  // Verify parent folder exists within tenant if provided
  if (parsed.parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parsed.parentId, tenantId },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
  }

  const folder = await prisma.folder.create({
    data: {
      tenantId,
      name: parsed.name,
      parentId: parsed.parentId ?? null,
      visible: parsed.visible ?? true,
      published: parsed.published ?? false,
      userGroups: parsed.userGroupIds?.length
        ? { connect: parsed.userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  return NextResponse.json(
    {
      folder: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        visible: folder.visible,
        published: folder.published,
        createdAt: folder.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
