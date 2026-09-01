import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { CourseCatalog } from "@/components/courses/course-catalog";

export default async function CoursesPage() {
  const tenantId = getTenantId();

  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId, published: true },
      include: {
        category: true,
        _count: { select: { chapters: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { tenantId, isCourse: true, published: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Courses</h1>
      <CourseCatalog
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          thumbnailUrl: c.thumbnailUrl,
          categoryName: c.category?.name ?? null,
          categoryColor: c.category?.color ?? null,
          level: c.level,
          specialStatus: c.specialStatus,
          price: c.price ? Number(c.price) : null,
          chapterCount: c._count.chapters,
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
      />
    </div>
  );
}
