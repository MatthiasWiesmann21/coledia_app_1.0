import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { PostsList } from "@/components/admin/posts-list";

export default async function AdminPostsPage() {
  const tenantId = getTenantId();

  const posts = await prisma.post.findMany({
    where: { tenantId },
    include: {
      category: true,
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Posts / News</h1>
      <PostsList
        posts={posts.map((p) => ({
          id: p.id,
          title: p.title,
          categoryName: p.category?.name ?? null,
          categoryColor: p.category?.color ?? null,
          imageUrl: p.imageUrl,
          published: p.published,
          scheduledAt: p.scheduledAt?.toISOString() ?? null,
          commentCount: p._count.comments,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
