import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { tenantHasFeature } from "@/lib/plan";
import { verifyApiKey } from "@/lib/api-keys";

// GET /api/v1/events — list published events
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  const apiKey = await verifyApiKey(authHeader.substring(7));
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (!(await tenantHasFeature(apiKey.tenantId, "apiAccess"))) {
    return NextResponse.json({ error: "plan_required", requiredPlan: "organization" }, { status: 403 });
  }

  const tenantId = apiKey.tenantId;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const upcoming = searchParams.get("upcoming") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const events = await prisma.event.findMany({
    where: {
      tenantId,
      published: true,
      ...(category ? { category: { name: category } } : {}),
      ...(upcoming ? { startAt: { gte: new Date() } } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      startAt: true,
      endAt: true,
      category: { select: { name: true, color: true } },
      _count: { select: { registrations: true } },
    },
    take: limit,
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({
    data: events.map((e) => ({
      ...e,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt?.toISOString() ?? null,
      registrationCount: e._count.registrations,
      _count: undefined,
    })),
  });
}
