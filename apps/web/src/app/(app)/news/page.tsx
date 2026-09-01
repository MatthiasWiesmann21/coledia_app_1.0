import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { NewsFeed } from "@/components/news/news-feed";

export default async function NewsPage() {
  const tenantId = getTenantId();

  const [posts, categories] = await Promise.all([
    prisma.post.findMany({
      where: {
        tenantId,
        published: true,
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: new Date() } },
        ],
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { tenantId, isNews: true, published: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">News</h1>
      <NewsFeed
        posts={posts.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
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
