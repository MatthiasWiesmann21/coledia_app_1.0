import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { getCurrentPlanLimits } from "@/lib/plan";
import { UsersList } from "@/components/admin/users-list";
import { Button } from "@coledia/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";

export default async function AdminUsersPage() {
  const { tenantId, membership, session } = await requireAdmin();

  const [memberships, { memberLimit }] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          include: { profiles: { where: { tenantId }, take: 1 } },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
    getCurrentPlanLimits(),
  ]);

  const memberCount = memberships.length;
  const limitReached = memberLimit !== null && memberCount >= memberLimit;

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Users</h1>
      <div className="mb-6 flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
          <Users className="h-4 w-4" />
          <span>
            <span className="font-medium text-[var(--foreground)]">
              {memberCount}
            </span>
            {" / "}
            {memberLimit === null ? "Unlimited" : memberLimit} members
          </span>
        </span>
        {limitReached && (
          <Button size="sm" asChild className="ml-auto">
            <Link href="/upgrade?feature=memberLimit">
              Member limit reached — upgrade plan
            </Link>
          </Button>
        )}
      </div>
      <UsersList
        viewerRole={membership.role}
        viewerUserId={session.user.id}
        users={memberships.map((m) => ({
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          email: m.user.email,
          username: m.user.profiles[0]?.username ?? null,
          avatarUrl: m.user.profiles[0]?.avatarUrl ?? null,
          status: m.user.profiles[0]?.status ?? "online",
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        }))}
      />
    </div>
  );
}
