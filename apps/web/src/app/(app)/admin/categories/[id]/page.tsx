import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { CategoryEditor } from "@/components/admin/category-editor";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireAdmin();

  const category = await prisma.category.findFirst({
    where: { id, tenantId },
  });

  if (!category) notFound();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit Category</h1>
      <CategoryEditor
        category={{
          id: category.id,
          name: category.name,
          isCourse: category.isCourse,
          isNews: category.isNews,
          isEvent: category.isEvent,
          color: category.color,
          textColorLight: category.textColorLight,
          textColorDark: category.textColorDark,
          published: category.published,
        }}
      />
    </div>
  );
}
