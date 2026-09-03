import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { TermsModal } from "@/components/terms-modal";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();
  const userId = session.user.id;

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  const needsTerms = !profile?.acceptedTermsAt;

  // Fetch all real data in parallel
  const [
    enrollments,
    completedChaptersCount,
    onlineMembers,
    upcomingEvents,
    recentComments,
    favourites,
  ] = await Promise.all([
    // All enrollments with course + category info
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
    }),

    // Count of completed chapters by this user
    prisma.chapterProgress.count({
      where: { userId, completed: true },
    }),

    // Online members count (tenant-wide)
    prisma.userProfile.count({
      where: { status: "online" },
    }),

    // Upcoming events the user is registered for
    prisma.eventRegistration.findMany({
      where: {
        userId,
        event: {
          tenantId,
          published: true,
          startAt: { gte: new Date() },
        },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startAt: true,
            thumbnailUrl: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { event: { startAt: "asc" } },
      take: 3,
    }),

    // Recent comments by this user
    prisma.comment.findMany({
      where: { userId, tenantId },
      include: {
        post: { select: { id: true, title: true } },
        chapter: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Favourited course IDs by this user
    prisma.favourite.findMany({
      where: { userId, targetType: "course" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Fetch the actual course data for favourited courses
  const favouriteCourseIds = favourites.map((f) => f.targetId);
  const favouriteCoursesData = favouriteCourseIds.length > 0
    ? await prisma.course.findMany({
        where: { id: { in: favouriteCourseIds } },
        select: {
          id: true,
          title: true,
          category: { select: { name: true, color: true } },
        },
      })
    : [];

  // Calculate stats from real data
  const inProgress = enrollments.filter(
    (e) => e.progressPct > 0 && e.progressPct < 100,
  ).length;
  const completed = enrollments.filter((e) => e.progressPct >= 100).length;

  // Build myCourses list (all enrolled courses, sorted by most recent)
  const myCourses = enrollments
    .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime())
    .slice(0, 5)
    .map((e) => ({
      id: e.course.id,
      title: e.course.title,
      category: e.course.category?.name ?? "Uncategorized",
      categoryColor: e.course.category?.color ?? "#008080",
      progress: Math.round(e.progressPct),
      paymentStatus: e.course.price ? "Paid" : "Free",
    }));

  // Build upcoming events list
  const events = upcomingEvents.map((reg) => ({
    id: reg.event.id,
    title: reg.event.title,
    startAt: reg.event.startAt.toISOString(),
    category: reg.event.category?.name ?? "General",
    categoryColor: reg.event.category?.color ?? "#008080",
  }));

  // Build recent activity from comments
  const recentActivity = recentComments.map((c) => ({
    id: c.id,
    type: "comment" as const,
    content: c.content.slice(0, 100),
    createdAt: c.createdAt.toISOString(),
    targetTitle: c.post?.title ?? c.chapter?.title ?? "Unknown",
    targetHref: c.post
      ? `/news/${c.post.id}`
      : c.chapter
        ? `/courses/${c.chapter.course.id}/chapters/${c.chapter.id}`
        : "#",
  }));

  // Build favourite courses (preserve the favourite order)
  const courseMap = new Map(favouriteCoursesData.map((c) => [c.id, c]));
  const favouriteCourses = favouriteCourseIds
    .map((id) => {
      const course = courseMap.get(id);
      if (!course) return null;
      return {
        id: course.id,
        title: course.title,
        category: course.category?.name ?? "Uncategorized",
        categoryColor: course.category?.color ?? "#008080",
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return (
    <>
      <TermsModal userId={userId} needsTerms={needsTerms} />
      <DashboardContent
        stats={{
          inProgress,
          completed,
          completedChapters: completedChaptersCount,
          onlineMembers,
        }}
        myCourses={myCourses}
        upcomingEvents={events}
        recentActivity={recentActivity}
        favouriteCourses={favouriteCourses}
      />
    </>
  );
}
