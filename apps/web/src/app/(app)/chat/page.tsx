import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();

  // Get user's group IDs for access filtering
  const userGroupIds = (
    await prisma.userGroupMember.findMany({
      where: { userId: session.user.id, userGroup: { tenantId } },
      select: { userGroupId: true },
    })
  ).map((m) => m.userGroupId);

  // Fetch chat servers with channels (filtered by user group)
  const chatServers = await prisma.chatServer.findMany({
    where: {
      tenantId,
      OR: [
        { userGroups: { none: {} } },
        { userGroups: { some: { id: { in: userGroupIds } } } },
      ],
    },
    include: {
      channels: {
        include: {
          userGroups: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      members: {
        include: {
          user: {
            include: { profile: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter channels per server by user group access:
  // keep channel if it has no user groups (visible to all server members)
  // OR the user is in one of the channel's user groups
  const filteredServers = chatServers.map((s) => ({
    ...s,
    channels: s.channels.filter(
      (c) =>
        c.userGroups.length === 0 ||
        c.userGroups.some((g) => userGroupIds.includes(g.id)),
    ),
  }));

  // Fetch all tenant members for DM list
  const tenantMembers = await prisma.membership.findMany({
    where: { tenantId },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  // Fetch existing DM conversations
  const dmConversations = await prisma.directConversation.findMany({
    where: {
      tenantId,
      OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
    },
    include: {
      user1: { include: { profile: true } },
      user2: { include: { profile: true } },
    },
  });

  return (
    <div className="h-full overflow-hidden">
      <ChatInterface
        currentUserId={session.user.id}
        currentUserName={session.user.name ?? session.user.email}
        tenantId={tenantId}
        chatServers={filteredServers.map((s) => ({
          id: s.id,
          name: s.name,
          channels: s.channels.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          })),
          members: s.members.map((m) => ({
            userId: m.userId,
            name: m.user.name ?? m.user.email,
            username: m.user.profile?.username ?? null,
            avatarUrl: m.user.profile?.avatarUrl ?? null,
            role: m.role,
          })),
        }))}
        tenantMembers={tenantMembers.map((m) => ({
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          username: m.user.profile?.username ?? null,
          avatarUrl: m.user.profile?.avatarUrl ?? null,
        }))}
        dmConversations={dmConversations.map((c) => {
          const otherUser = c.user1Id === session.user.id ? c.user2 : c.user1;
          return {
            id: c.id,
            otherUserId: otherUser.id,
            otherUserName: otherUser.name ?? otherUser.email,
            otherUserUsername: otherUser.profile?.username ?? null,
            otherUserAvatarUrl: otherUser.profile?.avatarUrl ?? null,
          };
        })}
      />
    </div>
  );
}
