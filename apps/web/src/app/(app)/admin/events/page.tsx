import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { EventsList } from "@/components/admin/events-list";

export default async function AdminEventsPage() {
  const tenantId = getTenantId();

  const events = await prisma.event.findMany({
    where: { tenantId },
    include: {
      category: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Live Events</h1>
      <EventsList
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          thumbnailUrl: e.thumbnailUrl,
          categoryName: e.category?.name ?? null,
          categoryColor: e.category?.color ?? null,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt?.toISOString() ?? null,
          published: e.published,
          registrationCount: e._count.registrations,
        }))}
      />
    </div>
  );
}
