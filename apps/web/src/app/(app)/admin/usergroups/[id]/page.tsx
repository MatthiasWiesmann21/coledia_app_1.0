import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { UserGroupEditor } from "@/components/admin/usergroup-editor";

export default async function EditUserGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireAdmin();

  const group = await prisma.userGroup.findFirst({
    where: { id, tenantId },
    include: {
      members: {
        include: {
          user: {
            include: { profile: true },
          },
        },
      },
    },
  });

  if (!group) notFound();

  // Get all tenant members for the add dropdown
  const tenantMembers = await prisma.membership.findMany({
    where: { tenantId },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit Usergroup</h1>
      <UserGroupEditor
        group={{
          id: group.id,
          name: group.name,
          members: group.members.map((m) => ({
            userId: m.userId,
            name: m.user.name ?? m.user.email,
            username: m.user.profile?.username ?? null,
          })),
        }}
        availableMembers={tenantMembers.map((m) => ({
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          username: m.user.profile?.username ?? null,
        }))}
      />
    </div>
  );
}
