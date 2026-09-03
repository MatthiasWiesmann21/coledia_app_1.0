import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { ChapterView } from "@/components/courses/chapter-view";
import {
  toggleChapterLike,
  toggleChapterFavourite,
  toggleChapterComplete,
  addComment,
  addCommentReply,
  toggleChapterCommentLike,
  getChapterComments,
} from "@/lib/course-actions";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  const tenantId = getTenantId();
  const session = await getSession();

  if (!session) redirect("/sign-in");

  const [course, chapter] = await Promise.all([
    prisma.course.findFirst({
      where: { id, tenantId, published: true },
      include: {
        chapters: {
          where: { published: true },
          orderBy: { order: "asc" },
          select: { id: true, title: true, order: true },
        },
      },
    }),
    prisma.chapter.findFirst({
      where: { id: chapterId, courseId: id, published: true },
    }),
  ]);

  if (!course || !chapter) notFound();

  // Check enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: course.id,
      },
    },
  });

  const canAccess =
    !!enrollment || course.price === null || Number(course.price) === 0 || chapter.accessFree;

  if (!canAccess) {
    redirect(`/courses/${course.id}`);
  }

  // Get chapter progress, likes, favourites, comments
  const [progress, userLike, userFav, allComments, likeCount] = await Promise.all([
    prisma.chapterProgress.findUnique({
      where: {
        userId_chapterId: {
          userId: session.user.id,
          chapterId: chapter.id,
        },
      },
    }),
    prisma.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: session.user.id,
          targetType: "chapter",
          targetId: chapter.id,
        },
      },
    }),
    prisma.favourite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: session.user.id,
          targetType: "chapter",
          targetId: chapter.id,
        },
      },
    }),
    prisma.comment.findMany({
      where: { chapterId: chapter.id },
      include: {
        user: { include: { profile: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.like.count({
      where: { targetType: "chapter", targetId: chapter.id },
    }),
  ]);

  // Build comment tree with like counts
  const commentIds = allComments.map((c) => c.id);
  const [commentLikeCounts, userCommentLikes] = await Promise.all([
    prisma.like.groupBy({
      by: ["targetId"],
      where: { targetType: "comment", targetId: { in: commentIds } },
      _count: { _all: true },
    }),
    prisma.like.findMany({
      where: {
        userId: session.user.id,
        targetType: "comment",
        targetId: { in: commentIds },
      },
      select: { targetId: true },
    }),
  ]);

  const commentLikeCountMap = new Map(
    commentLikeCounts.map((l) => [l.targetId, l._count._all]),
  );
  const userLikedCommentIds = new Set(userCommentLikes.map((l) => l.targetId));

  const commentMap = new Map<string, any>();
  allComments.forEach((c) => {
    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      authorName: c.user.name ?? c.user.email,
      authorUsername: c.user.profile?.username ?? null,
      authorAvatarUrl: c.user.profile?.avatarUrl ?? null,
      createdAt: c.createdAt.toISOString(),
      likeCount: commentLikeCountMap.get(c.id) ?? 0,
      liked: userLikedCommentIds.has(c.id),
      replies: [] as any[],
    });
  });

  const topLevelComments: any[] = [];
  allComments.forEach((c) => {
    const node = commentMap.get(c.id);
    if (c.parentId && commentMap.has(c.parentId)) {
      commentMap.get(c.parentId).replies.push(node);
    } else {
      topLevelComments.push(node);
    }
  });
  topLevelComments.reverse();

  // Find next/prev chapters
  const currentIndex = course.chapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentIndex > 0 ? course.chapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex < course.chapters.length - 1
      ? course.chapters[currentIndex + 1]
      : null;

  // Fetch all completed chapters for this course (for timeline)
  const completedProgress = await prisma.chapterProgress.findMany({
    where: {
      userId: session.user.id,
      chapter: { courseId: course.id },
      completed: true,
    },
    select: { chapterId: true },
  });
  const completedChapterIds = completedProgress.map((p) => p.chapterId);
  const completedCount = completedChapterIds.length;
  const totalChapters = course.chapters.length;
  const progressPct =
    totalChapters > 0 ? (completedCount / totalChapters) * 100 : 0;

  return (
    <div className="p-6">
      <ChapterView
        course={{
          id: course.id,
          title: course.title,
          chapters: course.chapters.map((c) => ({
            id: c.id,
            title: c.title,
          })),
        }}
        chapter={{
          id: chapter.id,
          title: chapter.title,
          description: chapter.description,
          videoUrl: chapter.videoUrl,
          videoType: chapter.videoType,
          author: chapter.author,
          duration: chapter.duration,
        }}
        completed={progress?.completed ?? false}
        liked={!!userLike}
        favourited={!!userFav}
        likeCount={likeCount}
        comments={topLevelComments}
        completedChapterIds={completedChapterIds}
        progressPct={progressPct}
        prevChapterId={prevChapter?.id ?? null}
        nextChapterId={nextChapter?.id ?? null}
        actions={{
          toggleLike: toggleChapterLike,
          toggleFavourite: toggleChapterFavourite,
          markComplete: toggleChapterComplete,
          addComment,
          addReply: addCommentReply,
          toggleCommentLike: toggleChapterCommentLike,
          getComments: getChapterComments,
        }}
      />
    </div>
  );
}
