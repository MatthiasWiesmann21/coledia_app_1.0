import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { ChapterEditor } from "@/components/admin/chapter-editor";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  const { tenantId } = await requireAdmin();

  const course = await prisma.course.findFirst({
    where: { id, tenantId },
    select: { id: true, title: true },
  });

  if (!course) notFound();

  const [chapter, translations] = await Promise.all([
    prisma.chapter.findFirst({
      where: { id: chapterId, courseId: course.id },
    }),
    prisma.translation.findMany({
      where: { entityType: "chapter", entityId: chapterId, tenantId },
    }),
  ]);

  if (!chapter) notFound();

  const translationsMap: Record<string, Record<string, string>> = {};
  for (const tr of translations) {
    if (!translationsMap[tr.language]) translationsMap[tr.language] = {};
    translationsMap[tr.language][tr.field] = tr.value;
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Edit Chapter</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Course: {course.title}
      </p>
      <ChapterEditor
        chapter={{
          id: chapter.id,
          courseId: chapter.courseId,
          title: chapter.title,
          description: chapter.description,
          duration: chapter.duration,
          level: chapter.level,
          author: chapter.author,
          videoUrl: chapter.videoUrl,
          videoType: chapter.videoType,
          accessFree: chapter.accessFree,
          published: chapter.published,
        }}
        translations={translationsMap}
      />
    </div>
  );
}
