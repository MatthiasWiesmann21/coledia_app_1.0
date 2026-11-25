import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { routeMember } from "@/lib/guards";

/** GET /api/usergroups — list all user groups for the current tenant */
export async function GET(_request: NextRequest) {
  const member = await routeMember();
  if (member instanceof Response) return member;
  const { tenantId } = member;

  const userGroups = await prisma.userGroup.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });

  return NextResponse.json({
    userGroups: userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g._count.members,
    })),
  });
}
