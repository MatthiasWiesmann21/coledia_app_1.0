import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { CourseEditor } from "@/components/admin/course-editor";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireAdmin();

  const [course, categories, userGroups, translations] = await Promise.all([
    prisma.course.findFirst({
      where: { id, tenantId },
      include: {
        chapters: { orderBy: { order: "asc" } },
      },
    }),
    prisma.category.findMany({
      where: { tenantId, isCourse: true, published: true },
      orderBy: { name: "asc" },
    }),
    prisma.userGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.translation.findMany({
      where: { entityType: "course", entityId: id, tenantId },
    }),
  ]);

  if (!course) notFound();

  // Build translations map: { language: { field: value } }
  const translationsMap: Record<string, Record<string, string>> = {};
  for (const tr of translations) {
    if (!translationsMap[tr.language]) translationsMap[tr.language] = {};
    translationsMap[tr.language][tr.field] = tr.value;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit Course</h1>
      <CourseEditor
        course={{
          id: course.id,
          title: course.title,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          categoryId: course.categoryId,
          userGroupId: course.userGroupId,
          duration: course.duration,
          level: course.level,
          specialStatus: course.specialStatus,
          price: course.price ? Number(course.price) : null,
          published: course.published,
          chapters: course.chapters.map((ch) => ({
            id: ch.id,
            title: ch.title,
            duration: ch.duration,
            level: ch.level,
            author: ch.author,
            videoUrl: ch.videoUrl,
            videoType: ch.videoType,
            accessFree: ch.accessFree,
            published: ch.published,
            order: ch.order,
          })),
        }}
        translations={translationsMap}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
        userGroups={userGroups.map((g) => ({
          id: g.id,
          name: g.name,
        }))}
      />
    </div>
  );
}
