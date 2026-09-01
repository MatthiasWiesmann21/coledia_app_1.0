import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { CategoriesList } from "@/components/admin/categories-list";

export default async function AdminCategoriesPage() {
  const tenantId = getTenantId();

  const categories = await prisma.category.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
      </div>
      <CategoriesList
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          isCourse: c.isCourse,
          isNews: c.isNews,
          isEvent: c.isEvent,
          color: c.color,
          textColorLight: c.textColorLight,
          textColorDark: c.textColorDark,
          published: c.published,
        }))}
      />
    </div>
  );
}
