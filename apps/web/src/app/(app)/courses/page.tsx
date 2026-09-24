import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { CourseCatalog } from "@/components/courses/course-catalog";
import { getUserLocale } from "@/i18n/get-locale";

export default async function CoursesPage() {
  const tenantId = getTenantId();
  const locale = await getUserLocale();
  const session = await getSession();

  // Get user's group IDs for access filtering
  const userGroupIds = session
    ? (
        await prisma.userGroupMember.findMany({
          where: { userId: session.user.id, userGroup: { tenantId } },
          select: { userGroupId: true },
        })
      ).map((m) => m.userGroupId)
    : [];

  const [courses, categories, translations] = await Promise.all([
    prisma.course.findMany({
      where: {
        tenantId,
        published: true,
        OR: [
          { userGroups: { none: {} } },
          { userGroups: { some: { id: { in: userGroupIds } } } },
        ],
      },
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
    prisma.translation.findMany({
      where: {
        tenantId,
        entityType: "course",
        field: { in: ["title"] },
      },
    }),
  ]);

  // Build translation map: { entityId: { language: { field: value } } }
  const trMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const tr of translations) {
    if (!trMap[tr.entityId]) trMap[tr.entityId] = {};
    if (!trMap[tr.entityId][tr.language]) trMap[tr.entityId][tr.language] = {};
    trMap[tr.entityId][tr.language][tr.field] = tr.value;
  }

  // Helper to get translated title
  const getTranslatedTitle = (id: string, fallback: string) => {
    const entityTr = trMap[id];
    if (!entityTr) return fallback;
    return entityTr[locale]?.title ?? entityTr["en"]?.title ?? fallback;
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Courses</h1>
      <CourseCatalog
        courses={courses.map((c) => ({
          id: c.id,
          title: getTranslatedTitle(c.id, c.title),
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
