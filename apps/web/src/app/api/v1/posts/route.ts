import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { tenantHasFeature } from "@/lib/plan";
import { verifyApiKey } from "@/lib/api-keys";

// GET /api/v1/posts — list published posts
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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const posts = await prisma.post.findMany({
    where: {
      tenantId,
      published: true,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      ...(category ? { category: { name: category } } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      createdAt: true,
      category: { select: { name: true, color: true } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
