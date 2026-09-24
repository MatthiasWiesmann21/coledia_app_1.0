import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";

/** GET /api/chat/dms/[otherUserId]/messages — fetch DM message history */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ otherUserId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { otherUserId } = await params;
  const tenantId = getTenantId();
  const userId = session.user.id;

  // Consistent ordering for DM conversation lookup
  const [user1Id, user2Id] =
    userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  const conversation = await prisma.directConversation.findUnique({
    where: {
      tenantId_user1Id_user2Id: { tenantId, user1Id, user2Id },
    },
  });

  if (!conversation) {
    return NextResponse.json({ messages: [] });
  }

  const messages = await prisma.message.findMany({
    where: { directConversationId: conversation.id },
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
