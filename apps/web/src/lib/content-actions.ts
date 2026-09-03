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

// ─── Posts (News) ───────────────────────────────────────────────

export async function createPost(data: {
  title: string;
  description?: string;
  categoryId?: string;
  userGroupIds?: string[];
  imageUrl?: string;
  gifUrl?: string;
}) {
  const { tenantId } = await requireAdmin();

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
  await requireAdmin();

  const { userGroupIds, ...rest } = data;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  const post = await prisma.post.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}`);
  revalidatePath("/news");
  revalidatePath(`/news/${id}`);
  return { id: post.id };
}

export async function deletePost(id: string) {
  await requireAdmin();

  await prisma.post.delete({ where: { id } });

  revalidatePath("/admin/posts");
  revalidatePath("/news");
}

export async function addPostComment(postId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const comment = await prisma.comment.create({
    data: {
      userId: session.user.id,
      tenantId,
      postId,
      content,
    },
  });

  revalidatePath(`/news/${postId}`);
  return comment;
}

export async function getPostComments(postId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const allComments = await prisma.comment.findMany({
    where: { postId },
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

export async function addCommentReply(postId: string, parentId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const comment = await prisma.comment.create({
    data: {
      userId: session.user.id,
      tenantId,
      postId,
      parentId,
      content,
    },
  });

  revalidatePath(`/news/${postId}`);
  return comment;
}

export async function togglePostLike(postId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const existing = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType: "post",
        targetId: postId,
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
        targetType: "post",
        targetId: postId,
      },
    });
  }

  revalidatePath(`/news/${postId}`);
}

export async function toggleCommentLike(commentId: string, postId: string) {
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

  revalidatePath(`/news/${postId}`);
}

// ─── Events ─────────────────────────────────────────────────────

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
}) {
  const { tenantId } = await requireAdmin();

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
      published: false,
      userGroups: data.userGroupIds?.length
        ? { connect: data.userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidatePath("/admin/events");
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
  },
) {
  await requireAdmin();

  const { userGroupIds, ...rest } = data;
  const updateData: any = { ...rest };
  if (userGroupIds !== undefined) {
    updateData.userGroups = {
      set: userGroupIds.map((gid) => ({ id: gid })),
    };
  }

  const event = await prisma.event.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  return { id: event.id };
}

export async function deleteEvent(id: string) {
  await requireAdmin();

  await prisma.event.delete({ where: { id } });

  revalidatePath("/admin/events");
  revalidatePath("/events");
}

export async function registerForEvent(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.eventRegistration.findUnique({
    where: {
      userId_eventId: {
        userId: session.user.id,
        eventId,
      },
    },
  });

  if (existing) {
    // Unregister
    await prisma.eventRegistration.delete({ where: { id: existing.id } });
  } else {
    await prisma.eventRegistration.create({
      data: { userId: session.user.id, eventId },
    });
  }

  revalidatePath(`/events/${eventId}`);
}

export async function toggleEventLike(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();

  const existing = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType: "event",
        targetId: eventId,
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
        targetType: "event",
        targetId: eventId,
      },
    });
  }

  revalidatePath(`/events/${eventId}`);
}
