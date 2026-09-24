import { prisma } from "@coledia/db";
import { pickProfile, tenantProfileInclude } from "./profile";

export type CommentNode = {
  id: string;
  content: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  canDelete: boolean;
  replies: CommentNode[];
};

/**
 * Load the comments of a post or chapter as a nested tree (newest top-level
 * first), with like counts, the viewer's likes and a per-comment delete flag.
 */
export async function buildCommentTree(
  viewer: { userId: string; isAdmin: boolean; tenantId: string },
  where: { postId?: string; chapterId?: string; tenantId: string },
): Promise<CommentNode[]> {
  const allComments = await prisma.comment.findMany({
    where,
    include: { user: { include: tenantProfileInclude(viewer.tenantId) } },
    orderBy: { createdAt: "asc" },
  });

  const commentIds = allComments.map((c) => c.id);
  const [likeCounts, viewerLikes] = commentIds.length
    ? await Promise.all([
        prisma.like.groupBy({
          by: ["targetId"],
          where: { tenantId: viewer.tenantId, targetType: "comment", targetId: { in: commentIds } },
          _count: { _all: true },
        }),
        prisma.like.findMany({
          where: { userId: viewer.userId, targetType: "comment", targetId: { in: commentIds } },
          select: { targetId: true },
        }),
      ])
    : [[], []];

  const likeCountMap = new Map(likeCounts.map((l) => [l.targetId, l._count._all]));
  const likedIds = new Set(viewerLikes.map((l) => l.targetId));

  const nodes = new Map<string, CommentNode>();
  for (const c of allComments) {
    const profile = pickProfile(c.user);
    nodes.set(c.id, {
      id: c.id,
      content: c.content,
      authorName: c.user.name ?? c.user.email,
      authorUsername: profile?.username ?? null,
      authorAvatarUrl: profile?.avatarUrl ?? null,
      createdAt: c.createdAt.toISOString(),
      likeCount: likeCountMap.get(c.id) ?? 0,
      liked: likedIds.has(c.id),
      canDelete: viewer.isAdmin || c.userId === viewer.userId,
      replies: [],
    });
  }

  const topLevel: CommentNode[] = [];
  for (const c of allComments) {
    const node = nodes.get(c.id)!;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else topLevel.push(node);
  }
  return topLevel.reverse();
}

/**
 * Delete a comment with all nested replies (the self-relation has no DB
 * cascade), plus the likes pointing at the deleted comments.
 */
export async function deleteCommentTree(rootId: string, tenantId: string): Promise<void> {
  const ids: string[] = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await prisma.comment.findMany({
      where: { parentId: { in: frontier }, tenantId },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }

  await prisma.$transaction([
    prisma.like.deleteMany({ where: { tenantId, targetType: "comment", targetId: { in: ids } } }),
    // Delete deepest replies first so no parent row is still referenced
    ...ids.reverse().map((id) => prisma.comment.deleteMany({ where: { id, tenantId } })),
  ]);
}
