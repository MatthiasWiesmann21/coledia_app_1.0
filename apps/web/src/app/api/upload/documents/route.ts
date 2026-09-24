import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { saveFile, storagePathToUrl, sanitizeFilename } from "@/lib/storage";
import {
  validateFile,
  validateFileSize,
} from "@/lib/file-security";
import { notify } from "@/lib/notifications";
import { assertStorageQuota } from "@/lib/storage-quota";

const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100MB

/** POST /api/upload/documents — upload a document to the Doc-Hub */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantId();

  // Check admin role
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folderId = (formData.get("folderId") as string | null) || null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, tenantId }, select: { id: true } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  // Validate file size
  const sizeResult = validateFileSize(file.size, MAX_DOC_SIZE);
  if (!sizeResult.valid) {
    return NextResponse.json({ error: sizeResult.error }, { status: 400 });
  }

  // Read buffer + full validation
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const validation = await validateFile(file, buffer, MAX_DOC_SIZE);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Enforce tenant storage quota (Starter 1GB / Club 10GB / Org unlimited)
  const quotaError = await assertStorageQuota(tenantId, file.size);
  if (quotaError) {
    return NextResponse.json({ error: quotaError }, { status: 413 });
  }

  const sanitizedName = sanitizeFilename(file.name);

  // Save to disk
  const storagePath = await saveFile(buffer, tenantId, "documents", sanitizedName);

  // Create DB record
  const document = await prisma.document.create({
    data: {
      tenantId,
      name: sanitizedName,
      folderId,
      fileUrl: storagePathToUrl(storagePath),
      storagePath,
      fileSize: BigInt(file.size),
      mimeType: validation.mimeType,
      fileType: sanitizedName.split(".").pop() ?? null,
      uploadedById: session.user.id,
      visible: true,
      published: false,
    },
  });

  // Notify members with access to the target folder (or all members if ungrouped)
  void (async () => {
    const folder = folderId
      ? await prisma.folder.findFirst({
          where: { id: folderId, tenantId },
          include: { userGroups: { select: { id: true } } },
        })
      : null;
    const groupIds = folder?.userGroups.map((g) => g.id) ?? [];
    await notify({
      tenantId,
      type: "document_update",
      title: `New document: ${document.name}`,
      link: "/documents",
      excludeUserIds: [session.user.id],
      ...(groupIds.length > 0 ? { userGroupIds: groupIds } : { allMembers: true }),
    });
  })();

  return NextResponse.json(
    {
      document: {
        id: document.id,
        name: document.name,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize?.toString() ?? "0",
        mimeType: document.mimeType,
        fileType: document.fileType,
        createdAt: document.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

export const config = {
  api: { bodyParser: false },
};
