"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { notify } from "./notifications";
import { logAuditAsync } from "./audit";
import { dispatchWebhookAsync } from "./webhooks";
import { tenantHasFeature } from "./plan";
import {
  requireAdminAction,
  requireMember,
  requireAccessibleChapter,
  assertTenantUserGroups,
  assertTenantCategory,
  getMyUserGroupIds,
  isFreeCourse,
  validateCommentContent,
} from "./guards";
import { buildCommentTree } from "./comments";
import { maybeIssueCertificate } from "./certificates";

/** Load a course of the current tenant or throw. */
async function requireTenantCourse(id: string, tenantId: string) {
  const course = await prisma.course.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!course) throw new Error("Course not found");
  return course;
}

/** Load a chapter whose course belongs to the current tenant or throw. */
async function requireTenantChapter(id: string, tenantId: string) {
  const chapter = await prisma.chapter.findFirst({
    where: { id, course: { tenantId } },
    select: { id: true, courseId: true, published: true },
  });
  if (!chapter) throw new Error("Chapter not found");
  return chapter;
}

// ─── Categories ─────────────────────────────────────────────────

export async function createCategory(data: {
  name: string;
  isCourse?: boolean;
  isNews?: boolean;
  isEvent?: boolean;
  color?: string;
  textColorLight?: string;
  textColorDark?: string;
}) {
  const { tenantId } = await requireAdminAction();

  const category = await prisma.category.create({
    data: {
      ...data,
      tenantId,
      published: false,
    },
  });

  revalidatePath("/admin/categories");
  return category;
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    isCourse?: boolean;
    isNews?: boolean;
    isEvent?: boolean;
    color?: string;
    textColorLight?: string;
    textColorDark?: string;
    published?: boolean;
  },
) {
  const { tenantId } = await requireAdminAction();

  const category = await prisma.category.update({
    where: { id, tenantId },
    data,
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  return category;
}

export async function deleteCategory(id: string) {
  const { tenantId } = await requireAdminAction();

  const { count } = await prisma.category.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("Category not found");

  revalidatePath("/admin/categories");
}

// ─── UserGroups ─────────────────────────────────────────────────

export async function createUserGroup(name: string) {
  const { tenantId } = await requireAdminAction();

  const group = await prisma.userGroup.create({
    data: { name, tenantId },
  });

  revalidatePath("/admin/usergroups");
  return group;
}

export async function updateUserGroup(id: string, name: string) {
  const { tenantId } = await requireAdminAction();

  const group = await prisma.userGroup.update({
    where: { id, tenantId },
    data: { name },
  });

  revalidatePath("/admin/usergroups");
  return group;
}

export async function deleteUserGroup(id: string) {
  const { tenantId } = await requireAdminAction();

  const { count } = await prisma.userGroup.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("User group not found");

  revalidatePath("/admin/usergroups");
}

export async function addUserToGroup(userGroupId: string, userId: string) {
  const { tenantId } = await requireAdminAction();

  await assertTenantUserGroups(tenantId, [userGroupId]);
  const member = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true },
  });
  if (!member) throw new Error("User is not a member of this community");

  await prisma.userGroupMember.create({
    data: { userGroupId, userId },
  });

  revalidatePath(`/admin/usergroups/${userGroupId}`);
}

export async function removeUserFromGroup(
  userGroupId: string,
  userId: string,
) {
  const { tenantId } = await requireAdminAction();

  await prisma.userGroupMember.deleteMany({
    where: { userGroupId, userId, userGroup: { tenantId } },
  });

  revalidatePath(`/admin/usergroups/${userGroupId}`);
}

// ─── Courses ────────────────────────────────────────────────────

export async function createCourse(data: {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  categoryId?: string;
  userGroupIds?: string[];
  duration?: string;
  level?: string;
  specialStatus?: string;
  price?: number;
}) {
  const { tenantId } = await requireAdminAction();

  if (
    (data.price ?? 0) > 0 &&
    !(await tenantHasFeature(tenantId, "sellCourses"))
  ) {
    throw new Error("Selling courses requires the Club plan or higher");
  }
  if (data.price !== undefined && data.price < 0) throw new Error("Invalid price");
  await assertTenantCategory(tenantId, data.categoryId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  const course = await prisma.course.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description || null,
      thumbnailUrl: data.thumbnailUrl || null,
      categoryId: data.categoryId || null,
      duration: data.duration || null,
      level: data.level || null,
      specialStatus: data.specialStatus || null,
      price: data.price ?? null,
      published: false,
      userGroups: data.userGroupIds?.length
        ? { connect: data.userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidatePath("/admin/courses");
  logAuditAsync({ action: "create", entityType: "course", entityId: course.id, metadata: { title: course.title } });
  dispatchWebhookAsync({ tenantId, event: "course.created", data: { id: course.id, title: course.title } });
  return { id: course.id };
}

export async function updateCourse(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    categoryId?: string | null;
    userGroupIds?: string[];
    duration?: string | null;
    level?: string | null;
    specialStatus?: string | null;
    price?: number | null;
    attachments?: any;
    published?: boolean;
  },
) {
  const { tenantId } = await requireAdminAction();

  if (
    data.price !== undefined &&
    data.price !== null &&
    data.price > 0 &&
    !(await tenantHasFeature(tenantId, "sellCourses"))
  ) {
    throw new Error("Selling courses requires the Club plan or higher");
  }
  if (data.price !== undefined && data.price !== null && data.price < 0) {
    throw new Error("Invalid price");
  }

  const previous = await prisma.course.findFirst({
    where: { id, tenantId },
    select: { published: true },
  });
  if (!previous) throw new Error("Course not found");
  await assertTenantCategory(tenantId, data.categoryId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  const { userGroupIds, ...rest } = data;
  const course = await prisma.course.update({
    where: { id, tenantId },
    data: {
      ...rest,
      ...(userGroupIds !== undefined
        ? { userGroups: { set: userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
    include: { userGroups: { select: { id: true } } },
  });

  // Notify when a course is published or updated (visible to enrolled users)
  if (data.published === true && !previous.published) {
    const groupIds = course.userGroups.map((g) => g.id);
    void notify({
      tenantId,
      type: "course_update",
      title: `New course: ${course.title}`,
      body: course.description ?? undefined,
      link: `/courses/${course.id}`,
      ...(groupIds.length > 0 ? { userGroupIds: groupIds } : { allMembers: true }),
    });
  } else if (data.published === undefined && course.published) {
    // Content changed on an already-published course → notify enrolled users
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: course.id },
      select: { userId: true },
    });
    if (enrollments.length > 0) {
      void notify({
        tenantId,
        type: "course_update",
        title: `Course updated: ${course.title}`,
        link: `/courses/${course.id}`,
        userIds: enrollments.map((e) => e.userId),
      });
    }
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
  logAuditAsync({ action: "update", entityType: "course", entityId: course.id, metadata: { published: data.published } });
  dispatchWebhookAsync({ tenantId, event: "course.updated", data: { id: course.id, title: course.title, published: data.published } });
  return { id: course.id };
}

export async function deleteCourse(id: string) {
  const { tenantId } = await requireAdminAction();

  const { count } = await prisma.course.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("Course not found");
  logAuditAsync({ action: "delete", entityType: "course", entityId: id });
  dispatchWebhookAsync({ tenantId, event: "course.deleted", data: { id } });

  revalidatePath("/admin/courses");
  revalidatePath("/courses");
}

// ─── Chapters ───────────────────────────────────────────────────

export async function createChapter(data: {
  courseId: string;
  title: string;
  description?: string;
  duration?: string;
  level?: string;
  author?: string;
  videoUrl?: string;
  videoType?: string;
  accessFree?: boolean;
}) {
  const { tenantId } = await requireAdminAction();
  await requireTenantCourse(data.courseId, tenantId);

  const count = await prisma.chapter.count({
    where: { courseId: data.courseId },
  });

  const chapter = await prisma.chapter.create({
    data: {
      ...data,
      order: count,
      published: false,
    },
  });

  revalidatePath(`/admin/courses/${data.courseId}`);
  logAuditAsync({ action: "create", entityType: "chapter", entityId: chapter.id, metadata: { courseId: data.courseId, title: chapter.title } });
  return chapter;
}

export async function updateChapter(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    duration?: string | null;
    level?: string | null;
    author?: string | null;
    videoUrl?: string | null;
    videoType?: string | null;
    accessFree?: boolean;
    published?: boolean;
    order?: number;
  },
) {
  const { tenantId } = await requireAdminAction();
  const previous = await requireTenantChapter(id, tenantId);

  const chapter = await prisma.chapter.update({
    where: { id },
    data,
    include: { course: { select: { title: true, published: true } } },
  });

  // Newly published chapter in a published course → notify enrolled users
  if (
    data.published === true &&
    !previous.published &&
    chapter.course.published
  ) {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: chapter.courseId },
      select: { userId: true },
    });
    if (enrollments.length > 0) {
      void notify({
        tenantId,
        type: "course_update",
        title: `New chapter in ${chapter.course.title}: ${chapter.title}`,
        link: `/courses/${chapter.courseId}/chapters/${chapter.id}`,
        userIds: enrollments.map((e) => e.userId),
      });
    }
  }

  revalidatePath(`/admin/courses/${chapter.courseId}`);
  logAuditAsync({ action: "update", entityType: "chapter", entityId: chapter.id, metadata: { published: data.published } });
  return chapter;
}

export async function deleteChapter(id: string) {
  const { tenantId } = await requireAdminAction();
  const chapter = await requireTenantChapter(id, tenantId);

  await prisma.chapter.delete({ where: { id } });
  logAuditAsync({ action: "delete", entityType: "chapter", entityId: id, metadata: { courseId: chapter.courseId } });

  revalidatePath(`/admin/courses/${chapter.courseId}`);
}

// ─── Enrollment ─────────────────────────────────────────────────

/**
 * Enroll in a FREE course. Paid courses can only be unlocked through the
 * Stripe checkout (the webhook creates the enrollment after payment).
 */
export async function enrollInCourse(courseId: string) {
  const { userId, tenantId, isAdmin } = await requireMember();

  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId, ...(isAdmin ? {} : { published: true }) },
    select: { id: true, price: true, userGroups: { select: { id: true } } },
  });
  if (!course) throw new Error("Course not found");

  if (!isAdmin && course.userGroups.length > 0) {
    const mine = await getMyUserGroupIds(userId, tenantId);
    if (!course.userGroups.some((g) => mine.includes(g.id))) {
      throw new Error("Course not found");
    }
  }

  if (!isFreeCourse(course.price) && !isAdmin) {
    throw new Error("This course must be purchased");
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    update: {},
    create: { userId, courseId: course.id },
  });

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return enrollment;
}

export async function toggleChapterComplete(chapterId: string) {
  const { userId, chapter } = await requireAccessibleChapter(chapterId);
  const courseId = chapter.courseId;

  const existing = await prisma.chapterProgress.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  const newCompleted = !existing?.completed;

  await prisma.chapterProgress.upsert({
    where: { userId_chapterId: { userId, chapterId } },
    update: { completed: newCompleted, completedAt: newCompleted ? new Date() : null },
    create: {
      userId,
      chapterId,
      completed: newCompleted,
      completedAt: newCompleted ? new Date() : null,
    },
  });

  // Progress counts only published chapters, so it can never exceed 100%
  const [totalChapters, completedChapters] = await Promise.all([
    prisma.chapter.count({ where: { courseId, published: true } }),
    prisma.chapterProgress.count({
      where: { userId, completed: true, chapter: { courseId, published: true } },
    }),
  ]);
  const progressPct =
    totalChapters > 0 ? Math.min(100, (completedChapters / totalChapters) * 100) : 0;

  // Only update an existing enrollment; auto-enroll only into free courses —
  // never create an enrollment (= access) for a paid course here.
  const enrollmentData = { progressPct, completedAt: progressPct >= 100 ? new Date() : null };
  const hasEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (hasEnrollment) {
    await prisma.enrollment.update({ where: { id: hasEnrollment.id }, data: enrollmentData });
  } else if (isFreeCourse(chapter.course.price)) {
    await prisma.enrollment.create({ data: { userId, courseId, ...enrollmentData } });
  }

  if (progressPct >= 100) {
    await maybeIssueCertificate(userId, courseId);
  }

  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/chapters/${chapterId}`);
  revalidatePath("/dashboard");

  return newCompleted;
}

// Keep markChapterComplete as an alias for backward compatibility
export async function markChapterComplete(chapterId: string) {
  return toggleChapterComplete(chapterId);
}

// ─── Likes / Favourites ─────────────────────────────────────────

async function togglePolymorphic(
  model: "like" | "favourite",
  userId: string,
  tenantId: string,
  targetType: string,
  targetId: string,
) {
  const where = { userId_targetType_targetId: { userId, targetType, targetId } };
  if (model === "like") {
    const existing = await prisma.like.findUnique({ where });
    if (existing) await prisma.like.delete({ where: { id: existing.id } });
    else await prisma.like.create({ data: { userId, tenantId, targetType, targetId } });
  } else {
    const existing = await prisma.favourite.findUnique({ where });
    if (existing) await prisma.favourite.delete({ where: { id: existing.id } });
    else await prisma.favourite.create({ data: { userId, tenantId, targetType, targetId } });
  }
}

export async function toggleChapterLike(chapterId: string) {
  const { userId, tenantId, chapter } = await requireAccessibleChapter(chapterId);
  await togglePolymorphic("like", userId, tenantId, "chapter", chapterId);
  revalidatePath(`/courses/${chapter.courseId}/chapters/${chapterId}`);
}

export async function toggleChapterFavourite(chapterId: string) {
  const { userId, tenantId, chapter } = await requireAccessibleChapter(chapterId);
  await togglePolymorphic("favourite", userId, tenantId, "chapter", chapterId);
  revalidatePath(`/courses/${chapter.courseId}/chapters/${chapterId}`);
}

// ─── Comments ───────────────────────────────────────────────────

export async function addComment(chapterId: string, content: string) {
  const { userId, tenantId, chapter } = await requireAccessibleChapter(chapterId);
  const text = validateCommentContent(content);

  const comment = await prisma.comment.create({
    data: { userId, tenantId, chapterId, content: text },
  });

  revalidatePath(`/courses/${chapter.courseId}/chapters/${chapterId}`);
  return { id: comment.id };
}

export async function addCommentReply(
  chapterId: string,
  parentId: string,
  content: string,
) {
  const { userId, tenantId, chapter } = await requireAccessibleChapter(chapterId);
  const text = validateCommentContent(content);

  const parent = await prisma.comment.findFirst({
    where: { id: parentId, chapterId, tenantId },
    select: { id: true },
  });
  if (!parent) throw new Error("Comment not found");

  const comment = await prisma.comment.create({
    data: { userId, tenantId, chapterId, parentId, content: text },
  });

  revalidatePath(`/courses/${chapter.courseId}/chapters/${chapterId}`);
  return { id: comment.id };
}

export async function toggleChapterCommentLike(
  commentId: string,
  chapterId: string,
) {
  const { userId, tenantId, chapter } = await requireAccessibleChapter(chapterId);

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, chapterId, tenantId },
    select: { id: true },
  });
  if (!comment) throw new Error("Comment not found");

  await togglePolymorphic("like", userId, tenantId, "comment", commentId);
  revalidatePath(`/courses/${chapter.courseId}/chapters/${chapterId}`);
}

export async function getChapterComments(chapterId: string) {
  const ctx = await requireAccessibleChapter(chapterId);
  return buildCommentTree(ctx, { chapterId, tenantId: ctx.tenantId });
}
