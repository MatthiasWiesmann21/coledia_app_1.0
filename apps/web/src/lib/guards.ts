import { prisma } from "@coledia/db";
import { ADMIN_ROLES, type Role } from "@coledia/shared";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { needsEmailVerification } from "./verification";
import { requireModule, type ModuleKey } from "./navigation";

/**
 * Authorization guards for server actions and route handlers.
 *
 * Every guard resolves the tenant from TENANT_ID and requires a Membership in
 * that tenant — a Better-Auth session alone is never enough, because the same
 * account can belong to several containers.
 */

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as string[]).includes(role);
}

/** Signed-in member of the current tenant. Throws otherwise. */
export async function requireMember() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership) throw new Error("Forbidden");
  if (await needsEmailVerification(session.user, membership.role)) {
    throw new Error("Email not verified");
  }

  return {
    session,
    tenantId,
    membership,
    userId: session.user.id,
    isAdmin: isAdminRole(membership.role),
  };
}

export type MemberContext = Awaited<ReturnType<typeof requireMember>>;

/** HTTP status for a guard error (route handlers). */
export function guardErrorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "Unauthorized") return 401;
  if (msg === "Module disabled" || msg === "Not found") return 404;
  return 403;
}

/**
 * Route-handler variant of requireMember (+ optional module check). Returns
 * the member context, or a JSON error Response to return as-is:
 *
 *   const m = await routeMember({ module: "documents" });
 *   if (m instanceof Response) return m;
 */
export async function routeMember(
  opts: { module?: ModuleKey; admin?: boolean } = {},
): Promise<MemberContext | Response> {
  try {
    const ctx = await requireMember();
    if (opts.admin && !ctx.isAdmin) throw new Error("Forbidden");
    if (opts.module) await requireModule(opts.module, ctx);
    return ctx;
  } catch (err) {
    const status = guardErrorStatus(err);
    const error = status === 401 ? "Unauthorized" : status === 404 ? "Not found" : "Forbidden";
    return Response.json({ error }, { status });
  }
}

/** Owner / admin / operator of the current tenant. Throws otherwise. */
export async function requireAdminAction() {
  const ctx = await requireMember();
  if (!ctx.isAdmin) throw new Error("Forbidden");
  return ctx;
}

/** Owner of the current tenant. Throws otherwise. */
export async function requireOwnerAction() {
  const ctx = await requireMember();
  if ((ctx.membership.role as Role) !== "owner") throw new Error("Forbidden");
  return ctx;
}

/**
 * Ensure every referenced user group belongs to the tenant before it is
 * connected to content — prevents linking another tenant's groups.
 */
export async function assertTenantUserGroups(
  tenantId: string,
  ids: string[] | undefined | null,
): Promise<void> {
  if (!ids?.length) return;
  const unique = [...new Set(ids)];
  const count = await prisma.userGroup.count({
    where: { id: { in: unique }, tenantId },
  });
  if (count !== unique.length) throw new Error("Invalid user group");
}

/** Ensure a category id (if given) belongs to the tenant. */
export async function assertTenantCategory(
  tenantId: string,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const found = await prisma.category.findFirst({
    where: { id: categoryId, tenantId },
    select: { id: true },
  });
  if (!found) throw new Error("Invalid category");
}

/** Ensure a folder id (if given) belongs to the tenant. */
export async function assertTenantFolder(
  tenantId: string,
  folderId: string | null | undefined,
): Promise<void> {
  if (!folderId) return;
  const found = await prisma.folder.findFirst({
    where: { id: folderId, tenantId },
    select: { id: true },
  });
  if (!found) throw new Error("Invalid folder");
}

/** The current user's user-group ids within this tenant. */
export async function getMyUserGroupIds(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const rows = await prisma.userGroupMember.findMany({
    where: { userId, userGroup: { tenantId } },
    select: { userGroupId: true },
  });
  return rows.map((r) => r.userGroupId);
}

/** Prisma filter: content without groups, or with one of the user's groups. */
export function groupVisibilityFilter(userGroupIds: string[]) {
  return {
    OR: [
      { userGroups: { none: {} } },
      { userGroups: { some: { id: { in: userGroupIds } } } },
    ],
  };
}

/** Whether a course is free (no price or price 0). */
export function isFreeCourse(price: unknown): boolean {
  return price === null || price === undefined || Number(price) <= 0;
}

/**
 * Whether a user may open a course's content. Admins always may; members need
 * the course to be free or an enrollment (paid enrollments are only created by
 * the Stripe webhook after a successful purchase).
 */
export async function canAccessCourse(
  userId: string,
  course: { id: string; price: unknown },
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin || isFreeCourse(course.price)) return true;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { id: true },
  });
  return !!enrollment;
}

/**
 * Load a chapter the current member may interact with (like, comment,
 * complete, take the quiz): same tenant, published chapter + course, group
 * visibility and paid-course access all enforced. Admins bypass visibility.
 */
export async function requireAccessibleChapter(chapterId: string) {
  const ctx = await requireMember();
  await requireModule("courses", ctx);
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      course: { tenantId: ctx.tenantId },
      ...(ctx.isAdmin ? {} : { published: true }),
    },
    include: {
      course: {
        select: {
          id: true,
          price: true,
          published: true,
          userGroups: { select: { id: true } },
        },
      },
    },
  });
  if (!chapter) throw new Error("Not found");

  if (!ctx.isAdmin) {
    if (!chapter.course.published) throw new Error("Not found");
    if (chapter.course.userGroups.length > 0) {
      const mine = await getMyUserGroupIds(ctx.userId, ctx.tenantId);
      if (!chapter.course.userGroups.some((g) => mine.includes(g.id))) {
        throw new Error("Not found");
      }
    }
    if (
      !chapter.accessFree &&
      !(await canAccessCourse(ctx.userId, chapter.course, false))
    ) {
      throw new Error("Purchase required");
    }
  }

  return { ...ctx, chapter };
}

/** Load a post the current member may see (published, scheduled, groups). */
export async function requireVisiblePost(postId: string) {
  const ctx = await requireMember();
  await requireModule("news", ctx);
  const groupIds = ctx.isAdmin ? [] : await getMyUserGroupIds(ctx.userId, ctx.tenantId);
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      tenantId: ctx.tenantId,
      ...(ctx.isAdmin
        ? {}
        : {
            published: true,
            AND: [
              { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
              groupVisibilityFilter(groupIds),
            ],
          }),
    },
    select: { id: true },
  });
  if (!post) throw new Error("Not found");
  return { ...ctx, post };
}

/** Load an event the current member may see (published, groups). */
export async function requireVisibleEvent(eventId: string) {
  const ctx = await requireMember();
  await requireModule("events", ctx);
  const groupIds = ctx.isAdmin ? [] : await getMyUserGroupIds(ctx.userId, ctx.tenantId);
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      tenantId: ctx.tenantId,
      ...(ctx.isAdmin ? {} : { published: true, ...groupVisibilityFilter(groupIds) }),
    },
  });
  if (!event) throw new Error("Not found");
  return { ...ctx, event };
}

/** Validate user-written comment text. */
export function validateCommentContent(content: string): string {
  const trimmed = (content ?? "").trim();
  if (trimmed.length < 1) throw new Error("Comment cannot be empty");
  if (trimmed.length > 5000) throw new Error("Comment is too long (max 5000 characters)");
  return trimmed;
}
