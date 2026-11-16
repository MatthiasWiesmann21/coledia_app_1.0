import { redirect } from "next/navigation";
import { prisma } from "@coledia/db";
import { requireMember } from "@/lib/guards";
import { accessibleRoomKeys } from "@/lib/chat/access";
import { displayName } from "@/lib/chat/serialize";
import { pickProfile, tenantProfileInclude } from "@/lib/profile";
import { getUnreadCounts } from "@/lib/chat-message-actions";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch {
    redirect("/sign-in");
  }
  const { tenantId, userId } = ctx;

  const roomKeys = new Set(await accessibleRoomKeys(ctx));

  const [servers, memberships, conversations, unread] = await Promise.all([
    prisma.chatServer.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        channels: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membership.findMany({
      where: { tenantId },
      select: {
        user: { select: { id: true, name: true, email: true, ...tenantProfileInclude(tenantId) } },
      },
    }),
    prisma.directConversation.findMany({
      where: { tenantId, OR: [{ user1Id: userId }, { user2Id: userId }] },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        messages: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    getUnreadCounts(),
  ]);

  const members = memberships
    .map(({ user }) => {
      const profile = pickProfile(user);
      return {
        id: user.id,
        name: displayName(user),
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const me = members.find((m) => m.id === userId) ?? { id: userId, name: "", username: null, avatarUrl: null };

  const visibleServers = servers
    .map((s) => ({ ...s, channels: s.channels.filter((c) => roomKeys.has(`channel:${c.id}`)) }))
    .filter((s) => s.channels.length > 0 || ctx.isAdmin);

  // Most recent conversations first
  const dms = conversations
    .sort(
      (a, b) => (b.messages[0]?.createdAt.getTime() ?? 0) - (a.messages[0]?.createdAt.getTime() ?? 0),
    )
    .map((c) => ({ room: `dm:${c.id}`, otherUserId: c.user1Id === userId ? c.user2Id : c.user1Id }));

  const { room } = await searchParams;
  const initialRoom = room && roomKeys.has(room) ? room : null;

  return (
    <div className="h-full overflow-hidden">
      <ChatInterface
        me={me}
        isAdmin={ctx.isAdmin}
        servers={visibleServers}
        members={members}
        conversations={dms}
        initialUnread={unread}
        initialRoom={initialRoom}
      />
    </div>
  );
}
