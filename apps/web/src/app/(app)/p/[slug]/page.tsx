import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { requireFeatureOrBack } from "@/lib/plan";
import { requireMember, getMyUserGroupIds } from "@/lib/guards";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Public custom page renderer — Organization tier only.
 *  HTML + CSS are rendered inside a sandboxed iframe to prevent XSS
 *  from compromising the host application. */
export default async function CustomPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenantId = getTenantId();

  // Gate: Organization tier only — send visitors back where they came from
  await requireFeatureOrBack("customPages", `/p/${slug}`);

  const page = await prisma.customPage.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: { userGroups: { select: { id: true } } },
  });

  if (!page || !page.published) {
    notFound();
  }

  const ctx = await requireMember().catch(() => null);
  if (!ctx) redirect("/sign-in");

  // Owners/admins can see all pages; members need the page enabled in
  // Settings → Navigation and (if restricted) one of its user groups.
  if (!ctx.isAdmin) {
    const navItem = await prisma.navigationItem.findUnique({
      where: { customPageId: page.id },
      select: { enabled: true },
    });
    if (navItem && !navItem.enabled) notFound();

    if (page.userGroups.length > 0) {
      const myGroups = await getMyUserGroupIds(ctx.userId, tenantId);
      if (!page.userGroups.some((g) => myGroups.includes(g.id))) notFound();
    }
  }

  const previewDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${page.contentCss ?? ""}</style></head><body>${page.contentHtml}</body></html>`;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">{page.title}</h1>
      <iframe
        srcDoc={previewDoc}
        title={page.title}
        sandbox="allow-same-origin"
        className="min-h-[60vh] w-full rounded-lg border border-border bg-white"
      />
    </div>
  );
}
