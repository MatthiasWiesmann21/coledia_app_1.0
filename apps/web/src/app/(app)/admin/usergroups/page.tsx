import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { UserGroupsList } from "@/components/admin/usergroups-list";

export default async function AdminUserGroupsPage() {
  const { tenantId } = await requireAdmin();

  const groups = await prisma.userGroup.findMany({
    where: { tenantId },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Usergroups</h1>
      <UserGroupsList
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g._count.members,
        }))}
      />
    </div>
  );
}
