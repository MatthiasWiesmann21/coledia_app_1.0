import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireAdmin();

  const [post, categories] = await Promise.all([
    prisma.post.findFirst({ where: { id, tenantId } }),
    prisma.category.findMany({
      where: { tenantId, isNews: true, published: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!post) notFound();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit Post</h1>
      <PostEditor
        post={{
          id: post.id,
          title: post.title,
          description: post.description,
          categoryId: post.categoryId,
          imageUrl: post.imageUrl,
          gifUrl: post.gifUrl,
          published: post.published,
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
        }}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
      />
    </div>
  );
}
