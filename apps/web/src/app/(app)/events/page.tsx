import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { requireFeatureOrBack } from "@/lib/plan";
import { EventsList } from "@/components/events/events-list-view";
import { getUserLocale } from "@/i18n/get-locale";

export default async function EventsPage() {
  await requireFeatureOrBack("liveEvents", "/events");
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

  const [events, categories, translations] = await Promise.all([
    prisma.event.findMany({
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
        _count: { select: { registrations: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.category.findMany({
      where: { tenantId, isEvent: true, published: true },
      orderBy: { name: "asc" },
    }),
    prisma.translation.findMany({
      where: {
        tenantId,
        entityType: "event",
        field: { in: ["title"] },
      },
    }),
  ]);

  const trMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const tr of translations) {
    if (!trMap[tr.entityId]) trMap[tr.entityId] = {};
    if (!trMap[tr.entityId][tr.language]) trMap[tr.entityId][tr.language] = {};
    trMap[tr.entityId][tr.language][tr.field] = tr.value;
  }

  const getTr = (entityId: string, field: string, fallback: string) => {
    const entityTr = trMap[entityId];
    if (!entityTr) return fallback;
    return entityTr[locale]?.[field] ?? entityTr["en"]?.[field] ?? fallback;
  };

  const now = new Date();
  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events.filter((e) => e.startAt < now);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Live Events</h1>
      <EventsList
        upcomingEvents={upcoming.map((e) => ({
          id: e.id,
          title: getTr(e.id, "title", e.title),
          thumbnailUrl: e.thumbnailUrl,
          categoryName: e.category?.name ?? null,
          categoryColor: e.category?.color ?? null,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt?.toISOString() ?? null,
          registrationCount: e._count.registrations,
        }))}
        pastEvents={past.map((e) => ({
          id: e.id,
          title: getTr(e.id, "title", e.title),
          thumbnailUrl: e.thumbnailUrl,
          categoryName: e.category?.name ?? null,
          categoryColor: e.category?.color ?? null,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt?.toISOString() ?? null,
          registrationCount: e._count.registrations,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      />
    </div>
  );
}
