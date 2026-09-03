import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { ChatServerManager } from "@/components/admin/chat-server-manager";

export default async function AdminChatPage() {
  const { tenantId } = await requireAdmin();

  const [chatServers, userGroups] = await Promise.all([
    prisma.chatServer.findMany({
      where: { tenantId },
      include: {
        userGroups: { select: { id: true, name: true } },
        channels: {
          include: { userGroups: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { channels: true, members: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Chat Servers</h1>
      <ChatServerManager
        servers={chatServers.map((s) => ({
          id: s.id,
          name: s.name,
          userGroupIds: s.userGroups.map((g) => g.id),
          userGroupNames: s.userGroups.map((g) => g.name),
          channelCount: s._count.channels,
          memberCount: s._count.members,
          channels: s.channels.map((c) => ({
            id: c.id,
            name: c.name,
            userGroupIds: c.userGroups.map((g) => g.id),
            userGroupNames: c.userGroups.map((g) => g.name),
          })),
        }))}
        userGroups={userGroups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </div>
  );
}
