import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { hasFeature } from "@/lib/plan";
import { getMyUserGroupIds, groupVisibilityFilter, routeMember } from "@/lib/guards";
import { buildIcsEvent } from "@/lib/ics";

/** GET /api/events/[id]/ics — download an event as an iCalendar (.ics) file */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await routeMember({ module: "events" });
  if (member instanceof Response) return member;
  const { tenantId, isAdmin, userId } = member;
  if (!(await hasFeature("liveEvents"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const groupIds = isAdmin ? [] : await getMyUserGroupIds(userId, tenantId);

  const event = await prisma.event.findFirst({
    where: {
      id,
      tenantId,
      ...(isAdmin ? {} : { published: true, ...groupVisibilityFilter(groupIds) }),
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const eventUrl = new URL(`/events/${event.id}`, request.nextUrl.origin).toString();
  const ics = buildIcsEvent({
    uid: `${event.id}@${request.nextUrl.hostname}`,
    title: event.title,
    description: event.description,
    location: event.location ?? (event.videoUrl ? "Online" : null),
    url: eventUrl,
    startAt: event.startAt,
    endAt: event.endAt,
    updatedAt: event.updatedAt,
  });

  const filename = event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
