import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { CoursesList } from "@/components/admin/courses-list";

export default async function AdminCoursesPage() {
  const { tenantId } = await requireAdmin();

  const courses = await prisma.course.findMany({
    where: { tenantId },
    include: {
      category: true,
      _count: { select: { chapters: true, enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Courses</h1>
      <CoursesList
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          thumbnailUrl: c.thumbnailUrl,
          categoryName: c.category?.name ?? null,
          categoryColor: c.category?.color ?? null,
          level: c.level,
          specialStatus: c.specialStatus,
          price: c.price ? Number(c.price) : null,
          published: c.published,
          chapterCount: c._count.chapters,
          enrollmentCount: c._count.enrollments,
        }))}
      />
    </div>
  );
}
