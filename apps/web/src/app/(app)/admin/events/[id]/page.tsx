import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { EventEditor } from "@/components/admin/event-editor";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireAdmin();

  const [event, categories, userGroups, translations] = await Promise.all([
    prisma.event.findFirst({
      where: { id, tenantId },
      include: { userGroups: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({
      where: { tenantId, isEvent: true, published: true },
      orderBy: { name: "asc" },
    }),
    prisma.userGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.translation.findMany({
      where: { entityType: "event", entityId: id, tenantId },
    }),
  ]);

  if (!event) notFound();

  const translationsMap: Record<string, Record<string, string>> = {};
  for (const tr of translations) {
    if (!translationsMap[tr.language]) translationsMap[tr.language] = {};
    translationsMap[tr.language][tr.field] = tr.value;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit Event</h1>
      <EventEditor
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          thumbnailUrl: event.thumbnailUrl,
          categoryId: event.categoryId,
          userGroupIds: event.userGroups.map((g) => g.id),
          startAt: event.startAt.toISOString().slice(0, 16),
          endAt: event.endAt?.toISOString().slice(0, 16) ?? "",
          videoUrl: event.videoUrl,
          videoType: event.videoType,
          streamChatEnabled: event.streamChatEnabled,
          published: event.published,
        }}
        translations={translationsMap}
        categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        userGroups={userGroups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </div>
  );
}
