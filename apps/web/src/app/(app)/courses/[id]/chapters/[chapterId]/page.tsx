import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { ChapterView } from "@/components/courses/chapter-view";
import {
  toggleChapterLike,
  toggleChapterFavourite,
  markChapterComplete,
  addComment,
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
  const [progress, userLike, userFav, comments, likeCount] = await Promise.all([
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
      orderBy: { createdAt: "desc" },
    }),
    prisma.like.count({
      where: { targetType: "chapter", targetId: chapter.id },
    }),
  ]);

  // Find next/prev chapters
  const currentIndex = course.chapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentIndex > 0 ? course.chapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex < course.chapters.length - 1
      ? course.chapters[currentIndex + 1]
      : null;

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
        comments={comments.map((c) => ({
          id: c.id,
          content: c.content,
          authorName: c.user.name ?? c.user.email,
          authorUsername: c.user.profile?.username ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
        prevChapterId={prevChapter?.id ?? null}
        nextChapterId={nextChapter?.id ?? null}
        actions={{
          toggleLike: toggleChapterLike,
          toggleFavourite: toggleChapterFavourite,
          markComplete: markChapterComplete,
          addComment,
        }}
      />
    </div>
  );
}
