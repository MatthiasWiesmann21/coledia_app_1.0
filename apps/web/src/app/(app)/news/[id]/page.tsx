import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { NewsDetail } from "@/components/news/news-detail";
import { addPostComment, togglePostLike } from "@/lib/content-actions";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = getTenantId();
  const session = await getSession();

  const post = await prisma.post.findFirst({
    where: {
      id,
      tenantId,
      published: true,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    include: { category: true },
  });

  if (!post) notFound();

  // Get comments, likes, user like
  const [comments, likeCount, userLike] = await Promise.all([
    prisma.comment.findMany({
      where: { postId: post.id },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.like.count({
      where: { targetType: "post", targetId: post.id },
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
  ]);

  // Get current user's profile for optimistic comment avatar
  const currentUserProfile = session
    ? await prisma.userProfile.findUnique({
        where: { userId: session.user.id },
      })
    : null;

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
        comments={comments.map((c) => ({
          id: c.id,
          content: c.content,
          authorName: c.user.name ?? c.user.email,
          authorUsername: c.user.profile?.username ?? null,
          authorAvatarUrl: c.user.profile?.avatarUrl ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
        isLoggedIn={!!session}
        currentUserAvatarUrl={currentUserProfile?.avatarUrl ?? null}
        actions={{
          toggleLike: togglePostLike,
          addComment: addPostComment,
        }}
      />
    </div>
  );
}
