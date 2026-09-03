import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";

/** GET /api/usergroups — list all user groups for the current tenant */
export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantId();

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
