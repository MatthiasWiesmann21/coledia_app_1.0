import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { deleteFile } from "@/lib/storage";
import { z } from "zod";

const updateDocSchema = z.object({
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

/** GET /api/documents/[id] — get document details */
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

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
    include: { userGroups: { select: { id: true, name: true } } },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    document: {
      id: document.id,
      name: document.name,
      fileUrl: document.fileUrl,
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

  const admin = await requireAdmin(session);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateDocSchema.parse(body);

  const { userGroupIds, ...rest } = parsed;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  const document = await prisma.document.update({
    where: { id },
    data: updateData,
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

  const admin = await requireAdmin(session);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = getTenantId();

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
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
