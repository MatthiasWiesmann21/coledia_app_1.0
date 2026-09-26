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

export type CommentPage = {
  comments: CommentNode[];
  hasMore: boolean;
  total: number;
};

/**
 * Load the comments of a post or chapter as a nested tree (newest top-level
 * first), with like counts, the viewer's likes and a per-comment delete flag.
 * Pagination applies to top-level comments only; replies always arrive
 * attached to their parent.
 */
export async function buildCommentTree(
  viewer: { userId: string; isAdmin: boolean; tenantId: string },
  where: { postId?: string; chapterId?: string; tenantId: string },
  opts?: { skip?: number; take?: number },
): Promise<CommentPage> {
  const skip = Math.max(0, opts?.skip ?? 0);
  const take = opts?.take;

  // Paginate top-level comments at the DB level (newest first)
  const [total, topRows] = await Promise.all([
    prisma.comment.count({ where: { ...where, parentId: null } }),
    prisma.comment.findMany({
      where: { ...where, parentId: null },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: { id: true },
    }),
  ]);

  // Fetch the page's top-level comments plus all their descendants
  const ids = new Set(topRows.map((r) => r.id));
  let frontier = topRows.map((r) => r.id);
  while (frontier.length > 0) {
    const children = await prisma.comment.findMany({
      where: { tenantId: where.tenantId, parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    for (const c of children) ids.add(c.id);
  }

  const allComments = ids.size
    ? await prisma.comment.findMany({
        where: { ...where, id: { in: [...ids] } },
        include: { user: { include: tenantProfileInclude(viewer.tenantId) } },
        orderBy: { createdAt: "asc" },
      })
    : [];

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
  // Keep the newest-first order from the pagination query
  const order = new Map(topRows.map((r, i) => [r.id, i]));
  topLevel.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { comments: topLevel, hasMore: skip + topLevel.length < total, total };
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
