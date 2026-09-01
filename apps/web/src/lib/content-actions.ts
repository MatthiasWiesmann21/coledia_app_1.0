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
  imageUrl?: string;
  gifUrl?: string;
}) {
  const { tenantId } = await requireAdmin();

  const post = await prisma.post.create({
    data: {
      ...data,
      tenantId,
      description: data.description || null,
      categoryId: data.categoryId || null,
      imageUrl: data.imageUrl || null,
      gifUrl: data.gifUrl || null,
      published: false,
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
    imageUrl?: string | null;
    gifUrl?: string | null;
    published?: boolean;
    scheduledAt?: Date | null;
  },
) {
  await requireAdmin();

  const post = await prisma.post.update({
    where: { id },
    data,
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

// ─── Events ─────────────────────────────────────────────────────

export async function createEvent(data: {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  categoryId?: string;
  userGroupId?: string;
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
      userGroupId: data.userGroupId || null,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      videoUrl: data.videoUrl || null,
      videoType: data.videoType || null,
      streamChatEnabled: data.streamChatEnabled ?? true,
      published: false,
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
    userGroupId?: string | null;
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

  const event = await prisma.event.update({
    where: { id },
    data,
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
