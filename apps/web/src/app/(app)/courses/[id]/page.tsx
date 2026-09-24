import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { CourseDetail } from "@/components/courses/course-detail";
import { enrollInCourse } from "@/lib/course-actions";
import { startCoursePurchase } from "@/lib/stripe-actions";
import { getUserLocale } from "@/i18n/get-locale";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = getTenantId();
  const session = await getSession();
  const locale = await getUserLocale();

  // Get user's group IDs for access filtering
  const userGroupIds = session
    ? (
        await prisma.userGroupMember.findMany({
          where: { userId: session.user.id, userGroup: { tenantId } },
          select: { userGroupId: true },
        })
      ).map((m) => m.userGroupId)
    : [];

  const [course, translations] = await Promise.all([
    prisma.course.findFirst({
      where: {
        id,
        tenantId,
        published: true,
        OR: [
          { userGroups: { none: {} } },
          { userGroups: { some: { id: { in: userGroupIds } } } },
        ],
      },
      include: {
        category: true,
        chapters: {
          where: { published: true },
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.translation.findMany({
      where: {
        tenantId,
        entityType: { in: ["course", "chapter"] },
        field: { in: ["title", "description"] },
      },
    }),
  ]);

  if (!course) notFound();

  // Build translation map
  const trMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const tr of translations) {
    if (!trMap[tr.entityId]) trMap[tr.entityId] = {};
    if (!trMap[tr.entityId][tr.language]) trMap[tr.entityId][tr.language] = {};
    trMap[tr.entityId][tr.language][tr.field] = tr.value;
  }

  const getTr = (entityId: string, field: string, fallback: string | null): string | null => {
    const entityTr = trMap[entityId];
    if (!entityTr) return fallback;
    return entityTr[locale]?.[field] ?? entityTr["en"]?.[field] ?? fallback;
  };

  const getTrStr = (entityId: string, field: string, fallback: string): string => {
    return getTr(entityId, field, fallback) ?? fallback;
  };

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
          title: getTrStr(course.id, "title", course.title),
          description: getTr(course.id, "description", course.description),
          thumbnailUrl: course.thumbnailUrl,
          categoryName: course.category?.name ?? null,
          categoryColor: course.category?.color ?? null,
          level: course.level,
          specialStatus: course.specialStatus,
          price: course.price ? Number(course.price) : null,
          duration: course.duration,
          chapters: course.chapters.map((ch) => ({
            id: ch.id,
            title: getTrStr(ch.id, "title", ch.title),
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
        purchaseAction={startCoursePurchase}
      />
    </div>
  );
}
