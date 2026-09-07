import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { tenantHasFeature } from "@/lib/plan";
import { verifyApiKey } from "@/lib/api-keys";

// GET /api/v1/courses — list published courses
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
