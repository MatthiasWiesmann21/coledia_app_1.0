import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();

  // Fetch chat servers with channels
  const chatServers = await prisma.chatServer.findMany({
    where: { tenantId },
    include: {
      channels: { orderBy: { createdAt: "asc" } },
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
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface
        currentUserId={session.user.id}
        currentUserName={session.user.name ?? session.user.email}
        tenantId={tenantId}
        chatServers={chatServers.map((s) => ({
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
