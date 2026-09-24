import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { NewsFeed } from "@/components/news/news-feed";
import { getUserLocale } from "@/i18n/get-locale";

export default async function NewsPage() {
  const tenantId = getTenantId();
  const locale = await getUserLocale();
  const session = await getSession();

  // Get user's group IDs for access filtering
  const userGroupIds = session
    ? (
        await prisma.userGroupMember.findMany({
          where: { userId: session.user.id, userGroup: { tenantId } },
          select: { userGroupId: true },
        })
      ).map((m) => m.userGroupId)
    : [];

  const [posts, categories, translations] = await Promise.all([
    prisma.post.findMany({
      where: {
        tenantId,
        published: true,
        AND: [
          {
            OR: [
              { scheduledAt: null },
              { scheduledAt: { lte: new Date() } },
            ],
          },
          {
            OR: [
              { userGroups: { none: {} } },
              { userGroups: { some: { id: { in: userGroupIds } } } },
            ],
          },
        ],
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { tenantId, isNews: true, published: true },
      orderBy: { name: "asc" },
    }),
    prisma.translation.findMany({
      where: {
        tenantId,
        entityType: "post",
        field: { in: ["title", "description"] },
      },
    }),
  ]);

  const trMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const tr of translations) {
    if (!trMap[tr.entityId]) trMap[tr.entityId] = {};
    if (!trMap[tr.entityId][tr.language]) trMap[tr.entityId][tr.language] = {};
    trMap[tr.entityId][tr.language][tr.field] = tr.value;
  }

  const getTr = (entityId: string, field: string, fallback: string | null): string | null => {
    const entityTr = trMap[entityId];
    if (!entityTr) return fallback;
    return entityTr[locale]?.[field] ?? entityTr["en"]?.[field] ?? fallback;
  };

  const getTrStr = (entityId: string, field: string, fallback: string): string => {
    return getTr(entityId, field, fallback) ?? fallback;
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">News</h1>
      <NewsFeed
        posts={posts.map((p) => ({
          id: p.id,
          title: getTrStr(p.id, "title", p.title),
          description: getTr(p.id, "description", p.description),
          imageUrl: p.imageUrl,
          gifUrl: p.gifUrl,
          categoryName: p.category?.name ?? null,
          categoryColor: p.category?.color ?? null,
          createdAt: p.createdAt.toISOString(),
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
      />
    </div>
  );
}
