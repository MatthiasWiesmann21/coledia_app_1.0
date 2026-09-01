"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { revalidatePath } from "next/cache";

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
  userGroupId?: string;
  duration?: string;
  level?: string;
  specialStatus?: string;
  price?: number;
}) {
  const { tenantId } = await requireAdmin();

  const course = await prisma.course.create({
    data: {
      ...data,
      tenantId,
      price: data.price ?? null,
      published: false,
    },
  });

  revalidatePath("/admin/courses");
  return course;
}

export async function updateCourse(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    categoryId?: string | null;
    userGroupId?: string | null;
    duration?: string | null;
    level?: string | null;
    specialStatus?: string | null;
    price?: number | null;
    attachments?: any;
    published?: boolean;
  },
) {
  await requireAdmin();

  const course = await prisma.course.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
  return course;
}

export async function deleteCourse(id: string) {
  await requireAdmin();

  await prisma.course.delete({ where: { id } });

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
  await requireAdmin();

  const chapter = await prisma.chapter.update({
    where: { id },
    data,
  });

  revalidatePath(`/admin/courses/${chapter.courseId}`);
  return chapter;
}

export async function deleteChapter(id: string) {
  await requireAdmin();

  const chapter = await prisma.chapter.delete({ where: { id } });

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

export async function markChapterComplete(chapterId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.chapterProgress.upsert({
    where: {
      userId_chapterId: {
        userId: session.user.id,
        chapterId,
      },
    },
    update: { completed: true, completedAt: new Date() },
    create: {
      userId: session.user.id,
      chapterId,
      completed: true,
      completedAt: new Date(),
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

    await prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: chapter.courseId,
        },
      },
      data: {
        progressPct,
        completedAt: progressPct >= 100 ? new Date() : null,
      },
    });

    revalidatePath(`/courses/${chapter.courseId}`);
  }
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
