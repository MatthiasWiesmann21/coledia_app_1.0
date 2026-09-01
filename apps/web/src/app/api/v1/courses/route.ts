import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";

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

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}

// GET /api/v1/courses — list published courses
export async function GET(req: NextRequest) {
  const apiKey = await verifyApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const tenantId = apiKey.tenantId;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const courses = await prisma.course.findMany({
    where: {
      tenantId,
      published: true,
      ...(category ? { category: { name: category } } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      duration: true,
      level: true,
      price: true,
      category: { select: { name: true, color: true } },
      _count: { select: { chapters: true, enrollments: true } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: courses.map((c) => ({
      ...c,
      price: c.price ? Number(c.price) : null,
      chapterCount: c._count.chapters,
      enrollmentCount: c._count.enrollments,
      _count: undefined,
    })),
  });
}
