import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminOverview } from "@/components/admin/admin-overview";

export default async function AdminPage() {
  const { tenantId } = await requireAdmin();

  const [
    totalUsers,
    totalCourses,
    totalPosts,
    totalEvents,
    publishedCourses,
    publishedPosts,
    publishedEvents,
    totalEnrollments,
    recentCourses,
    recentPosts,
    recentEvents,
  ] = await Promise.all([
    prisma.membership.count({ where: { tenantId } }),
    prisma.course.count({ where: { tenantId } }),
    prisma.post.count({ where: { tenantId } }),
    prisma.event.count({ where: { tenantId } }),
    prisma.course.count({ where: { tenantId, published: true } }),
    prisma.post.count({ where: { tenantId, published: true } }),
    prisma.event.count({ where: { tenantId, published: true } }),
    prisma.enrollment.count({ where: { course: { tenantId } } }),
    prisma.course.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, published: true, createdAt: true },
    }),
    prisma.post.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, published: true, createdAt: true },
    }),
    prisma.event.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, published: true, startAt: true },
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Admin Dashboard</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Manage your platform content and users
      </p>
      <AdminOverview
        stats={{
          totalUsers,
          totalCourses,
          totalPosts,
          totalEvents,
          publishedCourses,
          publishedPosts,
          publishedEvents,
          totalEnrollments,
        }}
        recentCourses={recentCourses.map((c) => ({
          id: c.id,
          title: c.title,
          published: c.published,
          createdAt: c.createdAt.toISOString(),
        }))}
        recentPosts={recentPosts.map((p) => ({
          id: p.id,
          title: p.title,
          published: p.published,
          createdAt: p.createdAt.toISOString(),
        }))}
        recentEvents={recentEvents.map((e) => ({
          id: e.id,
          title: e.title,
          published: e.published,
          startAt: e.startAt.toISOString(),
        }))}
      />
    </div>
  );
}
