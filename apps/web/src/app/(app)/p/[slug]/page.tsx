import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { hasFeature } from "@/lib/plan";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

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

  // Gate: Organization tier only
  if (!(await hasFeature("customPages"))) {
    redirect("/upgrade?feature=customPages");
  }

  const page = await prisma.customPage.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: { userGroups: { select: { id: true } } },
  });

  if (!page || !page.published) {
    notFound();
  }

  // User-group visibility check
  if (page.userGroups.length > 0) {
    const session = await getSession();
    if (!session) {
      redirect("/sign-in");
    }
    const membership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: session.user.id, tenantId } },
    });
    if (!membership) {
      notFound();
    }
    // Owners/admins can see all pages
    const isAdmin = ["owner", "admin", "operator"].includes(membership.role);
    if (!isAdmin) {
      const userGroupMemberships = await prisma.userGroupMember.findMany({
        where: { userId: session.user.id, userGroup: { id: { in: page.userGroups.map((g) => g.id) } } },
        select: { userGroupId: true },
      });
      const hasAccess = userGroupMemberships.length > 0;
      if (!hasAccess) {
        notFound();
      }
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
