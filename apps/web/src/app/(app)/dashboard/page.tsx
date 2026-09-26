import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { TermsModal } from "@/components/terms-modal";
import { DashboardContent } from "@/components/dashboard-content";
import { profileKey } from "@/lib/profile";
import { onlineSince as getOnlineSince } from "@/lib/presence";
import { getMyUserGroupIds, groupVisibilityFilter, isAdminRole } from "@/lib/guards";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();
  const userId = session.user.id;
  const tc = await getTranslations("common");

  // Everything below is scoped to THIS tenant — the same account may belong to
  // several containers, and nothing from another container may show up here.
  const profile = await prisma.userProfile.findUnique({
    where: profileKey(userId, tenantId),
  });

  const needsTerms = !profile?.acceptedTermsAt;
  const onlineSince = getOnlineSince();

  // Fetch all real data in parallel
  const [
    enrollments,
    completedChaptersCount,
    onlineMembers,
    upcomingEvents,
    recentComments,
    favourites,
    signedInMembers,
    membership,
  ] = await Promise.all([
    // Enrollments in this tenant's courses, with course + category info
    prisma.enrollment.findMany({
      where: { userId, course: { tenantId } },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
    }),

    // Count of completed (published) chapters by this user in this tenant
    prisma.chapterProgress.count({
      where: { userId, completed: true, chapter: { published: true, course: { tenantId } } },
    }),

    // Online members = members of this tenant seen here recently (not invisible)
    prisma.membership.count({
      where: {
        tenantId,
        lastSeenAt: { gte: onlineSince },
        user: { profiles: { none: { tenantId, status: "invisible" } } },
      },
    }),

    // Upcoming events the user is registered for
    prisma.eventRegistration.findMany({
      where: {
        userId,
        event: {
          tenantId,
          published: true,
          startAt: { gte: new Date() },
        },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startAt: true,
            thumbnailUrl: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { event: { startAt: "asc" } },
      take: 3,
    }),

    // Recent comments by this user
    prisma.comment.findMany({
      where: { userId, tenantId },
      include: {
        post: { select: { id: true, title: true } },
        chapter: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // All favourites of this user in this tenant (polymorphic targets)
    prisma.favourite.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),

    // Members of this tenant seen recently (per-tenant presence)
    prisma.membership.findMany({
      where: {
        tenantId,
        lastSeenAt: { gte: onlineSince },
        user: { profiles: { none: { tenantId, status: "invisible" } } },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profiles: {
              where: { tenantId },
              select: { avatarUrl: true, status: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
    }),

    prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true },
    }),
  ]);

  const isAdmin = isAdminRole(membership?.role);
  const myGroupIds = isAdmin ? [] : await getMyUserGroupIds(userId, tenantId);
  const groupVis = groupVisibilityFilter(myGroupIds);
  const visible = isAdmin ? {} : { published: true, ...groupVis };

  // Resolve favourite targets per type (tenant-scoped, visibility-checked so
  // unpublished or group-restricted content doesn't leak its title)
  const favIds = (type: string) =>
    favourites.filter((f) => f.targetType === type).map((f) => f.targetId);
  const [favCoursesData, favChaptersData, favPostsData, favEventsData] = await Promise.all([
    favIds("course").length
      ? prisma.course.findMany({
          where: { id: { in: favIds("course") }, tenantId, ...visible },
          select: { id: true, title: true },
        })
      : [],
    favIds("chapter").length
      ? prisma.chapter.findMany({
          where: {
            id: { in: favIds("chapter") },
            course: { tenantId, ...visible },
            ...(isAdmin ? {} : { published: true }),
          },
          select: { id: true, title: true, courseId: true },
        })
      : [],
    favIds("post").length
      ? prisma.post.findMany({
          where: {
            id: { in: favIds("post") },
            tenantId,
            ...(isAdmin
              ? {}
              : {
                  published: true,
                  AND: [
                    { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
                    groupVis,
                  ],
                }),
          },
          select: { id: true, title: true },
        })
      : [],
    favIds("event").length
      ? prisma.event.findMany({
          where: { id: { in: favIds("event") }, tenantId, ...visible },
          select: { id: true, title: true },
        })
      : [],
  ]);

  // Calculate stats from real data
  const inProgress = enrollments.filter(
    (e) => e.progressPct > 0 && e.progressPct < 100,
  ).length;
  const completed = enrollments.filter((e) => e.progressPct >= 100).length;

  // Build myCourses list (all enrolled courses, sorted by most recent)
  const myCourses = enrollments
    .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime())
    .slice(0, 5)
    .map((e) => ({
      id: e.course.id,
      title: e.course.title,
      category: e.course.category?.name ?? tc("uncategorized"),
      categoryColor: e.course.category?.color ?? "#008080",
      progress: Math.round(e.progressPct),
      paymentStatus:
        e.course.price && Number(e.course.price) > 0 ? tc("paid") : tc("free"),
    }));

  // Build upcoming events list
  const events = upcomingEvents.map((reg) => ({
    id: reg.event.id,
    title: reg.event.title,
    startAt: reg.event.startAt.toISOString(),
    category: reg.event.category?.name ?? tc("general"),
    categoryColor: reg.event.category?.color ?? "#008080",
  }));

  // Build recent activity from comments
  const recentActivity = recentComments.map((c) => ({
    id: c.id,
    type: "comment" as const,
    content: c.content.slice(0, 100),
    createdAt: c.createdAt.toISOString(),
    targetTitle: c.post?.title ?? c.chapter?.title ?? tc("unknown"),
    targetHref: c.post
      ? `/news/${c.post.id}`
      : c.chapter
        ? `/courses/${c.chapter.course.id}/chapters/${c.chapter.id}`
        : "#",
  }));

  // Build grouped favourites (preserve favourite order, drop stale targets)
  const favMaps = {
    course: new Map(favCoursesData.map((c) => [c.id, `/courses/${c.id}`] as const)),
    chapter: new Map(favChaptersData.map((c) => [c.id, `/courses/${c.courseId}/chapters/${c.id}`] as const)),
    post: new Map(favPostsData.map((p) => [p.id, `/news/${p.id}`] as const)),
    event: new Map(favEventsData.map((e) => [e.id, `/events/${e.id}`] as const)),
  };
  const favTitles = {
    course: new Map(favCoursesData.map((c) => [c.id, c.title])),
    chapter: new Map(favChaptersData.map((c) => [c.id, c.title])),
    post: new Map(favPostsData.map((p) => [p.id, p.title])),
    event: new Map(favEventsData.map((e) => [e.id, e.title])),
  };
  const favouriteItems = favourites
    .map((f) => {
      const map = favMaps[f.targetType as keyof typeof favMaps];
      const title = favTitles[f.targetType as keyof typeof favTitles]?.get(f.targetId);
      const href = map?.get(f.targetId);
      if (!title || !href) return null;
      return { id: f.id, targetType: f.targetType, targetId: f.targetId, title, href };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  // Build signed-in members list
  const onlineMembersList = signedInMembers.map((m) => {
    const memberProfile = m.user.profiles[0];
    return {
      id: m.user.id,
      name: m.user.name ?? m.user.email,
      avatarUrl: memberProfile?.avatarUrl ?? null,
      status: memberProfile?.status ?? "online",
      lastActive: (m.lastSeenAt ?? new Date()).toISOString(),
    };
  });

  return (
    <>
      <TermsModal userId={userId} needsTerms={needsTerms} />
      <DashboardContent
        stats={{
          inProgress,
          completed,
          completedChapters: completedChaptersCount,
          onlineMembers,
        }}
        myCourses={myCourses}
        upcomingEvents={events}
        recentActivity={recentActivity}
        favouriteItems={favouriteItems}
        onlineMembers={onlineMembersList}
      />
    </>
  );
}
