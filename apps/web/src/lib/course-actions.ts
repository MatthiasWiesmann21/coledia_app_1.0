"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { revalidatePath } from "next/cache";
import { notify } from "./notifications";
import { logAuditAsync } from "./audit";
import { dispatchWebhookAsync } from "./webhooks";
import { tenantHasFeature } from "./plan";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: session.user.id,
        tenantId: getTenantId(),
      },
    },
  });

  if (
    !membership ||
    !["owner", "admin", "operator"].includes(membership.role)
  ) {
    throw new Error("Forbidden");
  }

  return { session, tenantId: getTenantId() };
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
  const { tenantId } = await requireAdmin();

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
  await requireAdmin();

  const category = await prisma.category.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  return category;
}

export async function deleteCategory(id: string) {
  await requireAdmin();

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
}

// ─── UserGroups ─────────────────────────────────────────────────

export async function createUserGroup(name: string) {
  const { tenantId } = await requireAdmin();

  const group = await prisma.userGroup.create({
    data: { name, tenantId },
  });

  revalidatePath("/admin/usergroups");
  return group;
}

export async function updateUserGroup(id: string, name: string) {
  await requireAdmin();

  const group = await prisma.userGroup.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/admin/usergroups");
  return group;
}

export async function deleteUserGroup(id: string) {
  await requireAdmin();

  await prisma.userGroup.delete({ where: { id } });

  revalidatePath("/admin/usergroups");
}

export async function addUserToGroup(userGroupId: string, userId: string) {
  await requireAdmin();

  await prisma.userGroupMember.create({
    data: { userGroupId, userId },
  });

  revalidatePath(`/admin/usergroups/${userGroupId}`);
}

export async function removeUserFromGroup(
  userGroupId: string,
  userId: string,
) {
  await requireAdmin();

  await prisma.userGroupMember.delete({
    where: {
      userGroupId_userId: { userGroupId, userId },
    },
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
  const { tenantId } = await requireAdmin();

  if (
    (data.price ?? 0) > 0 &&
    !(await tenantHasFeature(tenantId, "sellCourses"))
  ) {
    throw new Error("Selling courses requires the Club plan or higher");
  }

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
  const { tenantId } = await requireAdmin();

  if (
    data.price !== undefined &&
    data.price !== null &&
    data.price > 0 &&
    !(await tenantHasFeature(tenantId, "sellCourses"))
  ) {
    throw new Error("Selling courses requires the Club plan or higher");
  }

  const previous =
    data.published !== undefined
      ? await prisma.course.findUnique({
          where: { id },
          select: { published: true },
        })
      : null;

  const { userGroupIds, ...rest } = data;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  const course = await prisma.course.update({
    where: { id },
    data: updateData,
    include: { userGroups: { select: { id: true } } },
  });

  // Notify when a course is published or updated (visible to enrolled users)
  if (data.published === true && previous?.published === false) {
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
  await requireAdmin();

  await prisma.course.delete({ where: { id } });
  logAuditAsync({ action: "delete", entityType: "course", entityId: id });
  dispatchWebhookAsync({ tenantId: getTenantId(), event: "course.deleted", data: { id } });

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
  await requireAdmin();

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
  const { tenantId } = await requireAdmin();

  const previous =
    data.published === true
      ? await prisma.chapter.findUnique({
          where: { id },
          select: { published: true },
        })
      : null;

  const chapter = await prisma.chapter.update({
    where: { id },
    data,
    include: { course: { select: { title: true, published: true } } },
  });

  // Newly published chapter in a published course → notify enrolled users
  if (
    data.published === true &&
    previous?.published === false &&
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
  await requireAdmin();

  const chapter = await prisma.chapter.delete({ where: { id } });
  logAuditAsync({ action: "delete", entityType: "chapter", entityId: id, metadata: { courseId: chapter.courseId } });

  revalidatePath(`/admin/courses/${chapter.courseId}`);
}

// ─── Enrollment ─────────────────────────────────────────────────

export async function enrollInCourse(courseId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId,
      },
    },
  });

  if (existing) return existing;

  const enrollment = await prisma.enrollment.create({
    data: { userId: session.user.id, courseId },
  });

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return enrollment;
}

export async function toggleChapterComplete(chapterId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Find existing progress to determine new state
  const existing = await prisma.chapterProgress.findUnique({
    where: {
      userId_chapterId: {
        userId: session.user.id,
        chapterId,
      },
    },
  });

  const newCompleted = !existing?.completed;

  await prisma.chapterProgress.upsert({
    where: {
      userId_chapterId: {
        userId: session.user.id,
        chapterId,
      },
    },
    update: { completed: newCompleted, completedAt: newCompleted ? new Date() : null },
    create: {
      userId: session.user.id,
      chapterId,
      completed: newCompleted,
      completedAt: newCompleted ? new Date() : null,
    },
  });

  // Update enrollment progress
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { courseId: true },
  });

  if (chapter) {
    const totalChapters = await prisma.chapter.count({
      where: { courseId: chapter.courseId, published: true },
    });

    const completedChapters = await prisma.chapterProgress.count({
      where: {
        userId: session.user.id,
        chapter: { courseId: chapter.courseId },
        completed: true,
      },
    });

    const progressPct =
      totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

    await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: chapter.courseId,
        },
      },
      update: {
        progressPct,
        completedAt: progressPct >= 100 ? new Date() : null,
      },
      create: {
        userId: session.user.id,
        courseId: chapter.courseId,
        progressPct,
        completedAt: progressPct >= 100 ? new Date() : null,
      },
    });

    // Course fully completed: issue certificate when the course has no quizzes
    // (quizzed courses issue certificates on quiz pass instead)
    if (progressPct >= 100) {
      const quizCount = await prisma.quiz.count({
        where: { chapter: { courseId: chapter.courseId } },
      });
      if (quizCount === 0) {
        const { issueCertificateForCourse } = await import("./certificates");
        await issueCertificateForCourse(session.user.id, chapter.courseId);
      }
    }

    revalidatePath(`/courses/${chapter.courseId}`);
  }

  return newCompleted;
}

// Keep markChapterComplete as an alias for backward compatibility
export async function markChapterComplete(chapterId: string) {
  return toggleChapterComplete(chapterId);
}

// ─── Likes / Favourites ─────────────────────────────────────────

export async function toggleChapterLike(chapterId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const existing = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType: "chapter",
        targetId: chapterId,
      },
    },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({
      data: {
        userId: session.user.id,
        tenantId,
        targetType: "chapter",
        targetId: chapterId,
      },
    });
  }

  revalidatePath(`/courses/chapters/${chapterId}`);
}

export async function toggleChapterFavourite(chapterId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const existing = await prisma.favourite.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType: "chapter",
        targetId: chapterId,
      },
    },
  });

  if (existing) {
    await prisma.favourite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favourite.create({
      data: {
        userId: session.user.id,
        tenantId,
        targetType: "chapter",
        targetId: chapterId,
      },
    });
  }

  revalidatePath(`/courses/chapters/${chapterId}`);
}

// ─── Comments ───────────────────────────────────────────────────

export async function addComment(chapterId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const comment = await prisma.comment.create({
    data: {
      userId: session.user.id,
      tenantId,
      chapterId,
      content,
    },
  });

  revalidatePath(`/courses/chapters/${chapterId}`);
  return comment;
}

export async function addCommentReply(
  chapterId: string,
  parentId: string,
  content: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const comment = await prisma.comment.create({
    data: {
      userId: session.user.id,
      tenantId,
      chapterId,
      parentId,
      content,
    },
  });

  revalidatePath(`/courses/chapters/${chapterId}`);
  return comment;
}

export async function toggleChapterCommentLike(
  commentId: string,
  chapterId: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const existing = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType: "comment",
        targetId: commentId,
      },
    },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({
      data: {
        userId: session.user.id,
        tenantId,
        targetType: "comment",
        targetId: commentId,
      },
    });
  }

  revalidatePath(`/courses/chapters/${chapterId}`);
}

export async function getChapterComments(chapterId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const allComments = await prisma.comment.findMany({
    where: { chapterId },
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: "asc" },
  });

  const commentIds = allComments.map((c) => c.id);
  const [commentLikeCounts, userCommentLikes] = await Promise.all([
    prisma.like.groupBy({
      by: ["targetId"],
      where: { targetType: "comment", targetId: { in: commentIds } },
      _count: { _all: true },
    }),
    prisma.like.findMany({
      where: {
        userId: session.user.id,
        targetType: "comment",
        targetId: { in: commentIds },
      },
      select: { targetId: true },
    }),
  ]);

  const commentLikeCountMap = new Map(
    commentLikeCounts.map((l) => [l.targetId, l._count._all]),
  );
  const userLikedCommentIds = new Set(userCommentLikes.map((l) => l.targetId));

  // Build nested comment tree
  const commentMap = new Map<string, any>();
  allComments.forEach((c) => {
    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      authorName: c.user.name ?? c.user.email,
      authorUsername: c.user.profile?.username ?? null,
      authorAvatarUrl: c.user.profile?.avatarUrl ?? null,
      createdAt: c.createdAt.toISOString(),
      likeCount: commentLikeCountMap.get(c.id) ?? 0,
      liked: userLikedCommentIds.has(c.id),
      replies: [],
    });
  });

  const topLevelComments: any[] = [];
  allComments.forEach((c) => {
    const node = commentMap.get(c.id);
    if (c.parentId && commentMap.has(c.parentId)) {
      commentMap.get(c.parentId).replies.push(node);
    } else {
      topLevelComments.push(node);
    }
  });
  topLevelComments.reverse();

  return topLevelComments;
}
