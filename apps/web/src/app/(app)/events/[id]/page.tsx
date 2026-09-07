import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/plan";
import { notFound, redirect } from "next/navigation";
import { EventDetail } from "@/components/events/event-detail";
import { registerForEvent, toggleEventLike } from "@/lib/content-actions";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFeature("liveEvents");
  const { id } = await params;
  const tenantId = getTenantId();
  const session = await getSession();

  // Get user's group IDs for access filtering
  const userGroupIds = session
    ? (
        await prisma.userGroupMember.findMany({
          where: { userId: session.user.id },
          select: { userGroupId: true },
        })
      ).map((m) => m.userGroupId)
    : [];

  const event = await prisma.event.findFirst({
    where: {
      id,
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
  });

  if (!event) notFound();

  // Check if user is registered
  let isRegistered = false;
  let userLike = null;
  let likeCount = 0;

  if (session) {
    const [reg, like, likes] = await Promise.all([
      prisma.eventRegistration.findUnique({
        where: {
          userId_eventId: {
            userId: session.user.id,
            eventId: event.id,
          },
        },
      }),
      prisma.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: session.user.id,
            targetType: "event",
            targetId: event.id,
          },
        },
      }),
      prisma.like.count({
        where: { targetType: "event", targetId: event.id },
      }),
    ]);
    isRegistered = !!reg;
    userLike = like;
    likeCount = likes;
  }

  return (
    <div className="p-6">
      <EventDetail
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          thumbnailUrl: event.thumbnailUrl,
          categoryName: event.category?.name ?? null,
          categoryColor: event.category?.color ?? null,
          startAt: event.startAt.toISOString(),
          endAt: event.endAt?.toISOString() ?? null,
          videoUrl: event.videoUrl,
          videoType: event.videoType,
          streamChatEnabled: event.streamChatEnabled,
          registrationCount: event._count.registrations,
        }}
        isRegistered={isRegistered}
        liked={!!userLike}
        likeCount={likeCount}
        isLoggedIn={!!session}
        registerAction={registerForEvent}
        likeAction={toggleEventLike}
      />
    </div>
  );
}
