import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { DocumentBrowser } from "@/components/documents/document-browser";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  const isAdmin =
    !!membership && ["owner", "admin", "operator"].includes(membership.role);

  // Get user's group IDs for role-based visibility filtering
  const userGroupIds = (
    await prisma.userGroupMember.findMany({
      where: { userId: session.user.id },
      select: { userGroupId: true },
    })
  ).map((m) => m.userGroupId);

  // Fetch root folders (visible + published for non-admins)
  const folders = await prisma.folder.findMany({
    where: {
      tenantId,
      parentId: null,
      ...(!isAdmin
        ? {
            visible: true,
            published: true,
            OR: [{ userGroupId: null }, { userGroupId: { in: userGroupIds } }],
          }
        : {}),
    },
    include: {
      _count: { select: { documents: true, children: true } },
      userGroup: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Fetch root documents (visible + published for non-admins)
  const documents = await prisma.document.findMany({
    where: {
      tenantId,
      folderId: null,
      ...(!isAdmin ? { visible: true, published: true } : {}),
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Documents</h1>
      <DocumentBrowser
        initialFolders={folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          userGroupId: f.userGroupId,
          userGroupName: f.userGroup?.name ?? null,
          visible: f.visible,
          published: f.published,
          fileCount: f._count.documents,
          folderCount: f._count.children,
          createdAt: f.createdAt.toISOString(),
        }))}
        initialDocuments={documents.map((d) => ({
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
        }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
