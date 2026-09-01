import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { EventsList } from "@/components/events/events-list-view";

export default async function EventsPage() {
  const tenantId = getTenantId();

  const [events, categories] = await Promise.all([
    prisma.event.findMany({
      where: { tenantId, published: true },
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
  ]);

  const now = new Date();
  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events.filter((e) => e.startAt < now);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Live Events</h1>
      <EventsList
        upcomingEvents={upcoming.map((e) => ({
          id: e.id,
          title: e.title,
          thumbnailUrl: e.thumbnailUrl,
          categoryName: e.category?.name ?? null,
          categoryColor: e.category?.color ?? null,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt?.toISOString() ?? null,
          registrationCount: e._count.registrations,
        }))}
        pastEvents={past.map((e) => ({
          id: e.id,
          title: e.title,
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
