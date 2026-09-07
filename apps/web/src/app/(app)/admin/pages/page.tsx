import { requireAdmin } from "@/lib/admin-guard";
import { requireFeature } from "@/lib/plan";
import { listCustomPages } from "@/lib/custom-page-actions";
import { CustomPagesList } from "@/components/admin/custom-pages-list";

export const dynamic = "force-dynamic";

export default async function AdminCustomPagesPage() {
  await requireAdmin();
  await requireFeature("customPages");

  const pages = await listCustomPages();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Custom Pages</h1>
      <CustomPagesList
        pages={pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          published: p.published,
          createdAt: p.createdAt.toISOString(),
          userGroups: p.userGroups.map((g) => g.name),
        }))}
      />
    </div>
  );
}
