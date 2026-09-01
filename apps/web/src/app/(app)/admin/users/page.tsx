import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { UsersList } from "@/components/admin/users-list";

export default async function AdminUsersPage() {
  const tenantId = getTenantId();

  const memberships = await prisma.membership.findMany({
    where: { tenantId },
    include: {
      user: {
        include: { profile: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <UsersList
        users={memberships.map((m) => ({
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          email: m.user.email,
          username: m.user.profile?.username ?? null,
          avatarUrl: m.user.profile?.avatarUrl ?? null,
          status: m.user.profile?.status ?? "online",
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        }))}
      />
    </div>
  );
}
