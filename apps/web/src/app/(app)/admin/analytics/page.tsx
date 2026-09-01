import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export default async function AdminAnalyticsPage() {
  const { tenantId } = await requireAdmin();

  // Gather stats in parallel
  const [
    totalUsers,
    totalCourses,
    totalPosts,
    totalEvents,
    totalEnrollments,
    publishedCourses,
    publishedPosts,
    publishedEvents,
    categories,
    recentEnrollments,
    courseStats,
  ] = await Promise.all([
    prisma.membership.count({ where: { tenantId } }),
    prisma.course.count({ where: { tenantId } }),
    prisma.post.count({ where: { tenantId } }),
    prisma.event.count({ where: { tenantId } }),
    prisma.enrollment.count({
      where: { course: { tenantId } },
    }),
    prisma.course.count({ where: { tenantId, published: true } }),
    prisma.post.count({ where: { tenantId, published: true } }),
    prisma.event.count({ where: { tenantId, published: true } }),
    prisma.category.findMany({
      where: { tenantId },
      include: {
        _count: { select: { courses: true, posts: true, events: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: { course: { tenantId } },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
      orderBy: { enrolledAt: "desc" },
      take: 10,
    }),
    prisma.course.findMany({
      where: { tenantId },
      include: {
        _count: { select: { enrollments: true, chapters: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>
      <AnalyticsDashboard
        stats={{
          totalUsers,
          totalCourses,
          totalPosts,
          totalEvents,
          totalEnrollments,
          publishedCourses,
          publishedPosts,
          publishedEvents,
        }}
        categories={categories.map((c) => ({
          name: c.name,
          color: c.color,
          courses: c._count.courses,
          posts: c._count.posts,
          events: c._count.events,
        }))}
        recentEnrollments={recentEnrollments.map((e) => ({
          id: e.id,
          userName: e.user.name ?? e.user.email,
          courseTitle: e.course.title,
          progress: Math.round(e.progressPct),
          enrolledAt: e.enrolledAt.toISOString(),
        }))}
        courseStats={courseStats.map((c) => ({
          id: c.id,
          title: c.title,
          enrollments: c._count.enrollments,
          chapters: c._count.chapters,
          published: c.published,
        }))}
      />
    </div>
  );
}
