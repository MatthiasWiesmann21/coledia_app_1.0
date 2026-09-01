import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { CourseDetail } from "@/components/courses/course-detail";
import { enrollInCourse } from "@/lib/course-actions";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = getTenantId();
  const session = await getSession();

  const course = await prisma.course.findFirst({
    where: { id, tenantId, published: true },
    include: {
      category: true,
      chapters: {
        where: { published: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) notFound();

  // Check if user is enrolled
  let enrollment = null;
  if (session) {
    enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: course.id,
        },
      },
    });
  }

  // Check chapter progress
  let completedChapters: string[] = [];
  if (session) {
    const progress = await prisma.chapterProgress.findMany({
      where: {
        userId: session.user.id,
        chapter: { courseId: course.id },
        completed: true,
      },
      select: { chapterId: true },
    });
    completedChapters = progress.map((p) => p.chapterId);
  }

  return (
    <div className="p-6">
      <CourseDetail
        course={{
          id: course.id,
          title: course.title,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          categoryName: course.category?.name ?? null,
          categoryColor: course.category?.color ?? null,
          level: course.level,
          specialStatus: course.specialStatus,
          price: course.price ? Number(course.price) : null,
          duration: course.duration,
          chapters: course.chapters.map((ch) => ({
            id: ch.id,
            title: ch.title,
            duration: ch.duration,
            level: ch.level,
            author: ch.author,
            accessFree: ch.accessFree,
            videoType: ch.videoType,
          })),
        }}
        enrolled={!!enrollment}
        progressPct={enrollment?.progressPct ?? 0}
        completedChapterIds={completedChapters}
        isLoggedIn={!!session}
        enrollAction={enrollInCourse}
      />
    </div>
  );
}
