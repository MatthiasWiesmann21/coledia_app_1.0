import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { requireFeature } from "@/lib/plan";
import { getTenantId } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { CustomPageEditor } from "@/components/admin/custom-page-editor";

export const dynamic = "force-dynamic";

export default async function AdminCustomPageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  await requireFeature("customPages");

  const { id } = await params;
  const tenantId = getTenantId();

  const [page, userGroups] = await Promise.all([
    prisma.customPage.findUnique({
      where: { id, tenantId },
      include: { userGroups: { select: { id: true } } },
    }),
    prisma.userGroup.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!page) notFound();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit Page: {page.title}</h1>
      <CustomPageEditor
        page={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          contentHtml: page.contentHtml,
          contentCss: page.contentCss ?? "",
          published: page.published,
          userGroupIds: page.userGroups.map((g) => g.id),
        }}
        userGroups={userGroups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </div>
  );
}
