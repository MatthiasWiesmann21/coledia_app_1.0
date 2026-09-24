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
import { deleteComment } from "@/lib/content-actions";
import { getQuizForChapter } from "@/lib/quiz-actions";
import { buildCommentTree } from "@/lib/comments";
import {
  isAdminRole,
  canAccessCourse,
  getMyUserGroupIds,
  groupVisibilityFilter,
} from "@/lib/guards";
import { QuizPlayer } from "@/components/courses/quiz-player";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  const tenantId = getTenantId();
  const session = await getSession();

  if (!session) redirect("/sign-in");

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  });
  if (!membership) redirect("/dashboard");
  const isAdmin = isAdminRole(membership.role);
  const userGroupIds = isAdmin ? [] : await getMyUserGroupIds(session.user.id, tenantId);

  const [course, chapter] = await Promise.all([
    prisma.course.findFirst({
      where: {
        id,
        tenantId,
        ...(isAdmin ? {} : { published: true, ...groupVisibilityFilter(userGroupIds) }),
      },
      include: {
        chapters: {
          where: { published: true },
          orderBy: { order: "asc" },
          select: { id: true, title: true, order: true },
        },
      },
    }),
    prisma.chapter.findFirst({
      where: { id: chapterId, courseId: id, ...(isAdmin ? {} : { published: true }) },
    }),
  ]);

  if (!course || !chapter) notFound();

  const canAccess =
    chapter.accessFree || (await canAccessCourse(session.user.id, course, isAdmin));

  if (!canAccess) {
    redirect(`/courses/${course.id}`);
  }

  const viewer = { userId: session.user.id, isAdmin, tenantId };

  // Get chapter progress, likes, favourites, comments
  const [progress, userLike, userFav, topLevelComments, likeCount] = await Promise.all([
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
    buildCommentTree(viewer, { chapterId: chapter.id, tenantId }),
    prisma.like.count({
      where: { tenantId, targetType: "chapter", targetId: chapter.id },
    }),
  ]);

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
      chapter: { courseId: course.id, published: true },
      completed: true,
    },
    select: { chapterId: true },
  });
  const completedChapterIds = completedProgress.map((p) => p.chapterId);
  const completedCount = completedChapterIds.length;
  const totalChapters = course.chapters.length;
  const progressPct =
    totalChapters > 0 ? Math.min(100, (completedCount / totalChapters) * 100) : 0;

  // Quiz for this chapter (Club+ feature; returns null when locked or absent)
  const quiz = await getQuizForChapter(chapter.id).catch(() => null);

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
          deleteComment,
        }}
      />
      {quiz && <QuizPlayer quiz={quiz} />}
    </div>
  );
}
