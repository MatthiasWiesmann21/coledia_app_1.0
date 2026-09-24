import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { profileKey } from "@/lib/profile";
import { notFound } from "next/navigation";
import { NewsDetail } from "@/components/news/news-detail";
import {
  addPostComment,
  addCommentReply,
  togglePostLike,
  toggleCommentLike,
  getPostComments,
  deleteComment,
} from "@/lib/content-actions";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = getTenantId();
  const session = await getSession();

  // Get user's group IDs for access filtering
  const userGroupIds = session
    ? (
        await prisma.userGroupMember.findMany({
          where: { userId: session.user.id, userGroup: { tenantId } },
          select: { userGroupId: true },
        })
      ).map((m) => m.userGroupId)
    : [];

  const post = await prisma.post.findFirst({
    where: {
      id,
      tenantId,
      published: true,
      AND: [
        {
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: new Date() } },
          ],
        },
        {
          OR: [
            { userGroups: { none: {} } },
            { userGroups: { some: { id: { in: userGroupIds } } } },
          ],
        },
      ],
    },
    include: { category: true },
  });

  if (!post) notFound();

  // Get post likes, user's post like, comment count, and current user's profile
  const [likeCount, userLike, commentCount, currentUserProfile] = await Promise.all([
    prisma.like.count({
      where: { tenantId, targetType: "post", targetId: post.id },
    }),
    session
      ? prisma.like.findUnique({
          where: {
            userId_targetType_targetId: {
              userId: session.user.id,
              targetType: "post",
              targetId: post.id,
            },
          },
        })
      : null,
    prisma.comment.count({
      where: { postId: post.id, parentId: null },
    }),
    session
      ? prisma.userProfile.findUnique({
          where: profileKey(session.user.id, tenantId),
        })
      : null,
  ]);

  return (
    <div className="p-6">
      <NewsDetail
        post={{
          id: post.id,
          title: post.title,
          description: post.description,
          imageUrl: post.imageUrl,
          gifUrl: post.gifUrl,
          categoryName: post.category?.name ?? null,
          categoryColor: post.category?.color ?? null,
          createdAt: post.createdAt.toISOString(),
        }}
        liked={!!userLike}
        likeCount={likeCount}
        commentCount={commentCount}
        isLoggedIn={!!session}
        currentUserAvatarUrl={currentUserProfile?.avatarUrl ?? null}
        actions={{
          toggleLike: togglePostLike,
          addComment: addPostComment,
          addReply: addCommentReply,
          toggleCommentLike,
          getComments: getPostComments,
          deleteComment,
        }}
      />
    </div>
  );
}
