import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { deleteFile } from "@/lib/storage";
import { isAdminRole, assertTenantUserGroups } from "@/lib/guards";
import { canViewDocument } from "@/lib/document-access";
import { z } from "zod";

const updateDocSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  visible: z.boolean().optional(),
  published: z.boolean().optional(),
  userGroupIds: z.array(z.string()).optional(),
});

async function getMembership(userId: string) {
  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  return { tenantId, membership, isAdmin: isAdminRole(membership?.role) };
}

/** GET /api/documents/[id] — get document details (visibility enforced) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { tenantId, membership, isAdmin } = await getMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
    include: { userGroups: { select: { id: true, name: true } } },
  });

  if (!document || (!isAdmin && !(await canViewDocument(session.user.id, tenantId, document)))) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    document: {
      id: document.id,
      name: document.name,
      fileUrl: `/api/documents/${document.id}/download`,
      fileSize: document.fileSize?.toString() ?? "0",
      mimeType: document.mimeType,
      fileType: document.fileType,
      folderId: document.folderId,
      userGroups: document.userGroups.map((g) => ({ id: g.id, name: g.name })),
      visible: document.visible,
      published: document.published,
      createdAt: document.createdAt.toISOString(),
    },
  });
}

/** PATCH /api/documents/[id] — update document metadata (admin only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, isAdmin } = await getMembership(session.user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateDocSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.document.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { userGroupIds, ...rest } = parsed.data;
  try {
    await assertTenantUserGroups(tenantId, userGroupIds);
  } catch {
    return NextResponse.json({ error: "Invalid user group" }, { status: 400 });
  }

  const document = await prisma.document.update({
    where: { id, tenantId },
    data: {
      ...rest,
      ...(userGroupIds !== undefined
        ? { userGroups: { set: userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
  });

  return NextResponse.json({
    document: {
      id: document.id,
      name: document.name,
      visible: document.visible,
      published: document.published,
    },
  });
}

/** DELETE /api/documents/[id] — delete a document (admin only) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, isAdmin } = await getMembership(session.user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete file from disk
  if (document.storagePath) {
    await deleteFile(document.storagePath);
  }

  // Delete DB record
  await prisma.document.delete({ where: { id, tenantId } });

  return NextResponse.json({ success: true });
}
