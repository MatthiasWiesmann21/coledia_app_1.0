"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { notify } from "./notifications";
import { logAuditAsync } from "./audit";
import { dispatchWebhookAsync } from "./webhooks";
import { hasFeature } from "./plan";
import {
  requireAdminAction,
  requireMember,
  requireVisiblePost,
  requireVisibleEvent,
  assertTenantUserGroups,
  assertTenantCategory,
  validateCommentContent,
} from "./guards";
import { buildCommentTree, deleteCommentTree } from "./comments";

// ─── Posts (News) ───────────────────────────────────────────────

export async function createPost(data: {
  title: string;
  description?: string;
  categoryId?: string;
  userGroupIds?: string[];
  imageUrl?: string;
  gifUrl?: string;
}) {
  const { tenantId } = await requireAdminAction();
  await assertTenantCategory(tenantId, data.categoryId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  const post = await prisma.post.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description || null,
      categoryId: data.categoryId || null,
      imageUrl: data.imageUrl || null,
      gifUrl: data.gifUrl || null,
      published: false,
      userGroups: data.userGroupIds?.length
        ? { connect: data.userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidatePath("/admin/posts");
  logAuditAsync({ action: "create", entityType: "post", entityId: post.id, metadata: { title: post.title } });
  dispatchWebhookAsync({ tenantId, event: "post.created", data: { id: post.id, title: post.title } });
  return { id: post.id };
}

export async function updatePost(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    userGroupIds?: string[];
    imageUrl?: string | null;
    gifUrl?: string | null;
    published?: boolean;
    scheduledAt?: Date | null;
  },
) {
  const { tenantId } = await requireAdminAction();

  const existing = await prisma.post.findFirst({
    where: { id, tenantId },
    select: { published: true },
  });
  if (!existing) throw new Error("Post not found");
  await assertTenantCategory(tenantId, data.categoryId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  const { userGroupIds, ...rest } = data;
  const post = await prisma.post.update({
    where: { id, tenantId },
    data: {
      ...rest,
      ...(userGroupIds !== undefined
        ? { userGroups: { set: userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
    include: { userGroups: { select: { id: true } } },
  });

  // Notify audience when a post is published for the first time
  if (data.published === true && !existing.published) {
    const groupIds = post.userGroups.map((g) => g.id);
    void notify({
      tenantId,
      type: "new_post",
      title: `New post: ${post.title}`,
      body: post.description ?? undefined,
      link: `/news/${post.id}`,
      ...(groupIds.length > 0 ? { userGroupIds: groupIds } : { allMembers: true }),
    });
  }

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}`);
  revalidatePath("/news");
  revalidatePath(`/news/${id}`);
  logAuditAsync({ action: "update", entityType: "post", entityId: post.id, metadata: { published: data.published } });
  dispatchWebhookAsync({ tenantId, event: "post.updated", data: { id: post.id, title: post.title, published: data.published } });
  return { id: post.id };
}

export async function deletePost(id: string) {
  const { tenantId } = await requireAdminAction();

  const { count } = await prisma.post.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("Post not found");
  logAuditAsync({ action: "delete", entityType: "post", entityId: id });
  dispatchWebhookAsync({ tenantId, event: "post.deleted", data: { id } });

  revalidatePath("/admin/posts");
  revalidatePath("/news");
}

// ─── Post comments ──────────────────────────────────────────────

export async function addPostComment(postId: string, content: string) {
  const { tenantId, userId } = await requireVisiblePost(postId);
  const text = validateCommentContent(content);

  const comment = await prisma.comment.create({
    data: { userId, tenantId, postId, content: text },
  });

  revalidatePath(`/news/${postId}`);
  return { id: comment.id };
}

export async function addCommentReply(postId: string, parentId: string, content: string) {
  const { tenantId, userId } = await requireVisiblePost(postId);
  const text = validateCommentContent(content);

  const parent = await prisma.comment.findFirst({
    where: { id: parentId, postId, tenantId },
    select: { id: true },
  });
  if (!parent) throw new Error("Comment not found");

  const comment = await prisma.comment.create({
    data: { userId, tenantId, postId, parentId, content: text },
  });

  revalidatePath(`/news/${postId}`);
  return { id: comment.id };
}

export async function getPostComments(postId: string) {
  const ctx = await requireVisiblePost(postId);
  return buildCommentTree(ctx, { postId, tenantId: ctx.tenantId });
}

/** Delete a comment (and its replies). Allowed for the author or a tenant admin. */
export async function deleteComment(commentId: string) {
  const { tenantId, userId, isAdmin } = await requireMember();

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, tenantId },
    select: { id: true, userId: true, postId: true, chapterId: true, chapter: { select: { courseId: true } } },
  });
  if (!comment) throw new Error("Comment not found");
  if (comment.userId !== userId && !isAdmin) throw new Error("Forbidden");

  await deleteCommentTree(comment.id, tenantId);

  if (comment.userId !== userId) {
    logAuditAsync({ action: "delete", entityType: "comment", entityId: comment.id, metadata: { moderated: true } });
  }
  if (comment.postId) revalidatePath(`/news/${comment.postId}`);
  if (comment.chapterId && comment.chapter) {
    revalidatePath(`/courses/${comment.chapter.courseId}/chapters/${comment.chapterId}`);
  }
}

// ─── Likes ──────────────────────────────────────────────────────

async function toggleLike(userId: string, tenantId: string, targetType: string, targetId: string) {
  const existing = await prisma.like.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { userId, tenantId, targetType, targetId } });
  }
}

export async function togglePostLike(postId: string) {
  const { tenantId, userId } = await requireVisiblePost(postId);
  await toggleLike(userId, tenantId, "post", postId);
  revalidatePath(`/news/${postId}`);
}

export async function toggleCommentLike(commentId: string, postId: string) {
  const { tenantId, userId } = await requireVisiblePost(postId);

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, postId, tenantId },
    select: { id: true },
  });
  if (!comment) throw new Error("Comment not found");

  await toggleLike(userId, tenantId, "comment", commentId);
  revalidatePath(`/news/${postId}`);
}

// ─── Events ─────────────────────────────────────────────────────

function parseMaxAttendees(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export async function createEvent(data: {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  categoryId?: string;
  userGroupIds?: string[];
  startAt: string; // ISO string
  endAt?: string;
  videoUrl?: string;
  videoType?: string;
  streamChatEnabled?: boolean;
  location?: string;
  maxAttendees?: number | null;
}) {
  const { tenantId } = await requireAdminAction();
  await assertTenantCategory(tenantId, data.categoryId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  const event = await prisma.event.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description || null,
      thumbnailUrl: data.thumbnailUrl || null,
      categoryId: data.categoryId || null,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      videoUrl: data.videoUrl || null,
      videoType: data.videoType || null,
      streamChatEnabled: data.streamChatEnabled ?? true,
      location: data.location?.trim() || null,
      maxAttendees: parseMaxAttendees(data.maxAttendees),
      published: false,
      userGroups: data.userGroupIds?.length
        ? { connect: data.userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidatePath("/admin/events");
  logAuditAsync({ action: "create", entityType: "event", entityId: event.id, metadata: { title: event.title } });
  dispatchWebhookAsync({ tenantId, event: "event.created", data: { id: event.id, title: event.title } });
  return { id: event.id };
}

export async function updateEvent(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    categoryId?: string | null;
    userGroupIds?: string[];
    startAt?: Date;
    endAt?: Date | null;
    videoUrl?: string | null;
    videoType?: string | null;
    streamChatEnabled?: boolean;
    published?: boolean;
    recurrenceRule?: string | null;
    location?: string | null;
    maxAttendees?: number | null;
  },
) {
  const { tenantId } = await requireAdminAction();

  const existing = await prisma.event.findFirst({
    where: { id, tenantId },
    select: { published: true },
  });
  if (!existing) throw new Error("Event not found");
  await assertTenantCategory(tenantId, data.categoryId);
  await assertTenantUserGroups(tenantId, data.userGroupIds);

  const { userGroupIds, location, maxAttendees, ...rest } = data;
  const event = await prisma.event.update({
    where: { id, tenantId },
    data: {
      ...rest,
      ...(location !== undefined ? { location: location?.trim() || null } : {}),
      ...(maxAttendees !== undefined ? { maxAttendees: parseMaxAttendees(maxAttendees) } : {}),
      ...(userGroupIds !== undefined
        ? { userGroups: { set: userGroupIds.map((gid) => ({ id: gid })) } }
        : {}),
    },
    include: { userGroups: { select: { id: true } } },
  });

  // Notify audience when an event is published for the first time
  if (data.published === true && !existing.published) {
    const groupIds = event.userGroups.map((g) => g.id);
    void notify({
      tenantId,
      type: "new_event",
      title: `New event: ${event.title}`,
      body: event.startAt.toLocaleString(),
      link: `/events/${event.id}`,
      ...(groupIds.length > 0 ? { userGroupIds: groupIds } : { allMembers: true }),
    });
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  logAuditAsync({ action: "update", entityType: "event", entityId: event.id, metadata: { published: data.published } });
  dispatchWebhookAsync({ tenantId, event: "event.updated", data: { id: event.id, title: event.title, published: data.published } });
  return { id: event.id };
}

export async function deleteEvent(id: string) {
  const { tenantId } = await requireAdminAction();

  const { count } = await prisma.event.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("Event not found");
  logAuditAsync({ action: "delete", entityType: "event", entityId: id });
  dispatchWebhookAsync({ tenantId, event: "event.deleted", data: { id } });

  revalidatePath("/admin/events");
  revalidatePath("/events");
}

/** Toggle the current user's registration. Enforces plan, visibility and capacity. */
export async function registerForEvent(eventId: string) {
  if (!(await hasFeature("liveEvents"))) throw new Error("plan_required");
  const { userId, event } = await requireVisibleEvent(eventId);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.eventRegistration.findUnique({
      where: { userId_eventId: { userId, eventId: event.id } },
    });

    if (existing) {
      await tx.eventRegistration.delete({ where: { id: existing.id } });
      return;
    }

    if (event.maxAttendees !== null) {
      // Lock the event row so concurrent registrations can't exceed capacity
      await tx.$queryRaw`SELECT id FROM Event WHERE id = ${event.id} FOR UPDATE`;
      const count = await tx.eventRegistration.count({ where: { eventId: event.id } });
      if (count >= event.maxAttendees) throw new Error("This event is full");
    }

    await tx.eventRegistration.create({ data: { userId, eventId: event.id } });
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
}

export async function toggleEventLike(eventId: string) {
  if (!(await hasFeature("liveEvents"))) throw new Error("plan_required");
  const { tenantId, userId } = await requireVisibleEvent(eventId);
  await toggleLike(userId, tenantId, "event", eventId);
  revalidatePath(`/events/${eventId}`);
}
