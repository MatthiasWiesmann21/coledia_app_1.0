import { prisma } from "@coledia/db";
import { getMyUserGroupIds } from "./guards";

/**
 * Whether a (non-admin) member may see a document: the document and its folder
 * must be visible + published, and both must pass user-group restrictions.
 */
export async function canViewDocument(
  userId: string,
  tenantId: string,
  document: {
    visible: boolean;
    published: boolean;
    folderId: string | null;
    userGroups: { id: string }[];
  },
): Promise<boolean> {
  if (!document.visible || !document.published) return false;

  const myGroups = await getMyUserGroupIds(userId, tenantId);
  const inGroups = (groups: { id: string }[]) =>
    groups.length === 0 || groups.some((g) => myGroups.includes(g.id));

  if (!inGroups(document.userGroups)) return false;

  if (document.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: document.folderId, tenantId, visible: true, published: true },
      include: { userGroups: { select: { id: true } } },
    });
    if (!folder || !inGroups(folder.userGroups)) return false;
  }

  return true;
}
