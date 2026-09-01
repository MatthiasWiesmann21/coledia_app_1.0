import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";

// Verify API key from header
async function verifyApiKey(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = authHeader.substring(7);
  const keyHash = Buffer.from(rawKey).toString("base64");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { tenant: true },
  });

  if (!apiKey) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}

// GET /api/v1/posts — list published posts
export async function GET(req: NextRequest) {
  const apiKey = await verifyApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
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
