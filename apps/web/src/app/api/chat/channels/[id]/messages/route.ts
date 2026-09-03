import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";

/** GET /api/chat/channels/[id]/messages — fetch channel message history */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId } = await params;
  const tenantId = getTenantId();
  const userId = session.user.id;

  // Verify the channel exists and belongs to this tenant
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      chatServer: { select: { tenantId: true } },
      userGroups: { select: { id: true } },
    },
  });

  if (!channel || channel.chatServer.tenantId !== tenantId) {
    return NextResponse.json(
      { error: "Channel not found" },
      { status: 404 },
    );
  }

  // Enforce channel-level user group access
  if (channel.userGroups.length > 0) {
    const membership = await prisma.userGroupMember.findFirst({
      where: {
        userId,
        userGroupId: { in: channel.userGroups.map((g) => g.id) },
      },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "No access to this channel" },
        { status: 403 },
      );
    }
  }

  const messages = await prisma.message.findMany({
    where: { channelId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
      reactions: {
        select: { userId: true, emoji: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name ?? m.user.email,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            content: m.replyTo.content,
            userId: m.replyTo.userId,
            userName: m.replyTo.user.name ?? m.replyTo.user.email,
          }
        : null,
      reactions: m.reactions.map((r) => ({
        userId: r.userId,
        emoji: r.emoji,
      })),
    })),
  });
}
