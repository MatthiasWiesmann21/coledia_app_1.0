import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { hasFeature } from "@/lib/plan";
import { isAdminRole, getMyUserGroupIds, groupVisibilityFilter } from "@/lib/guards";

/**
 * Global search endpoint (Spotlight-style).
 *
 * Searches across: courses, chapters, posts, events, documents,
 * chat servers + channels, and direct conversations (the other user's name).
 *
 * Returns grouped results, each item has: type, id, title, href, subtitle?
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantId();
  const userId = session.user.id;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }
  if (q.length > 100) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admins see everything in their tenant; members only what they could open.
  const isAdmin = isAdminRole(membership.role);
  const [groupIds, liveEvents] = await Promise.all([
    isAdmin ? Promise.resolve([] as string[]) : getMyUserGroupIds(userId, tenantId),
    hasFeature("liveEvents"),
  ]);
  const visible = (extra: Record<string, unknown> = {}) =>
    isAdmin ? {} : { published: true, ...groupVisibilityFilter(groupIds), ...extra };
  const groupsOnly = isAdmin ? {} : groupVisibilityFilter(groupIds);

  // Case-insensitive contains on MySQL
  const term = q;
  const textMatch = [
    { title: { contains: term } },
    { description: { contains: term } },
  ];

  const [
    courses,
    chapters,
    posts,
    events,
    documents,
    chatServers,
    channels,
    dmConversations,
  ] = await Promise.all([
    // Courses
    prisma.course.findMany({
      where: { tenantId, ...visible(), AND: [{ OR: textMatch }] },
      select: { id: true, title: true },
      take: 5,
    }),
    // Chapters (via course → tenantId)
    prisma.chapter.findMany({
      where: {
        course: { tenantId, ...visible() },
        ...(isAdmin ? {} : { published: true }),
        OR: textMatch,
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        course: { select: { title: true } },
      },
      take: 5,
    }),
    // Posts (scheduled posts stay hidden until their publish time)
    prisma.post.findMany({
      where: {
        tenantId,
        ...visible(),
        AND: [
          { OR: textMatch },
          ...(isAdmin
            ? []
            : [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }]),
        ],
      },
      select: { id: true, title: true },
      take: 5,
    }),
    // Events (hidden entirely when the plan has no live events)
    liveEvents || isAdmin
      ? prisma.event.findMany({
          where: { tenantId, ...visible(), AND: [{ OR: textMatch }] },
          select: { id: true, title: true },
          take: 5,
        })
      : Promise.resolve([] as { id: string; title: string }[]),
    // Documents (document + folder visibility and groups)
    prisma.document.findMany({
      where: {
        tenantId,
        name: { contains: term },
        ...(isAdmin
          ? {}
          : {
              visible: true,
              published: true,
              AND: [
                groupVisibilityFilter(groupIds),
                {
                  OR: [
                    { folderId: null },
                    {
                      folder: {
                        visible: true,
                        published: true,
                        ...groupVisibilityFilter(groupIds),
                      },
                    },
                  ],
                },
              ],
            }),
      },
      select: { id: true, name: true },
      take: 5,
    }),
    // Chat servers (chatrooms)
    prisma.chatServer.findMany({
      where: {
        tenantId,
        name: { contains: term },
        ...groupsOnly,
      },
      select: { id: true, name: true },
      take: 5,
    }),
    // Channels (via chatServer → tenantId)
    prisma.channel.findMany({
      where: {
        chatServer: { tenantId, ...groupsOnly },
        name: { contains: term },
        ...groupsOnly,
      },
      select: {
        id: true,
        name: true,
        chatServerId: true,
        chatServer: { select: { name: true } },
      },
      take: 5,
    }),
    // Direct conversations — search by the other user's name/email
    prisma.directConversation.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
          {
            OR: [
              {
                user1Id: userId,
                user2: {
                  OR: [
                    { name: { contains: term } },
                    { email: { contains: term } },
                  ],
                },
              },
              {
                user2Id: userId,
                user1: {
                  OR: [
                    { name: { contains: term } },
                    { email: { contains: term } },
                  ],
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        user1: { select: { id: true, name: true, email: true } },
        user2: { select: { id: true, name: true, email: true } },
      },
      take: 5,
    }),
  ]);

  const results: Array<{
    type: string;
    id: string;
    title: string;
    href: string;
    subtitle?: string;
  }> = [];

  for (const c of courses) {
    results.push({
      type: "course",
      id: c.id,
      title: c.title,
      href: `/courses/${c.id}`,
    });
  }
  for (const ch of chapters) {
    results.push({
      type: "chapter",
      id: ch.id,
      title: ch.title,
      subtitle: ch.course.title,
      href: `/courses/${ch.courseId}/chapters/${ch.id}`,
    });
  }
  for (const p of posts) {
    results.push({
      type: "post",
      id: p.id,
      title: p.title,
      href: `/news/${p.id}`,
    });
  }
  for (const e of events) {
    results.push({
      type: "event",
      id: e.id,
      title: e.title,
      href: `/events/${e.id}`,
    });
  }
  for (const d of documents) {
    results.push({
      type: "document",
      id: d.id,
      title: d.name,
      href: `/documents`,
    });
  }
  for (const s of chatServers) {
    results.push({
      type: "chatroom",
      id: s.id,
      title: s.name,
      href: `/chat`,
    });
  }
  for (const ch of channels) {
    results.push({
      type: "channel",
      id: ch.id,
      title: `#${ch.name}`,
      subtitle: ch.chatServer.name,
      href: `/chat`,
    });
  }
  for (const dm of dmConversations) {
    const other = dm.user1Id === session.user.id ? dm.user2 : dm.user1;
    results.push({
      type: "dm",
      id: dm.id,
      title: other.name ?? other.email,
      href: `/chat`,
    });
  }

  return NextResponse.json({ results });
}
