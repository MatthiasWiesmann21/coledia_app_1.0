"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { hasFeature } from "./plan";
import { logAuditAsync } from "./audit";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Only owners/admins can manage custom pages");
  }
  if (!(await hasFeature("customPages"))) {
    throw new Error("Custom pages require the Organization plan");
  }
  return { session, tenantId };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCustomPage(data: {
  title: string;
  slug?: string;
  contentHtml: string;
  contentCss?: string;
  published?: boolean;
  userGroupIds?: string[];
}) {
  const { tenantId } = await requireOwner();

  const slug = data.slug ? slugify(data.slug) : slugify(data.title);
  if (!slug) throw new Error("Invalid slug");

  const page = await prisma.customPage.create({
    data: {
      tenantId,
      title: data.title,
      slug,
      contentHtml: data.contentHtml,
      contentCss: data.contentCss ?? null,
      published: data.published ?? false,
      userGroups: data.userGroupIds?.length
        ? { connect: data.userGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  logAuditAsync({ action: "create", entityType: "custom_page", entityId: page.id, metadata: { title: data.title, slug } });
  revalidatePath("/admin/pages");
  revalidatePath(`/p/${slug}`);
  return { id: page.id, slug };
}

export async function updateCustomPage(
  id: string,
  data: {
    title?: string;
    slug?: string;
    contentHtml?: string;
    contentCss?: string | null;
    published?: boolean;
    userGroupIds?: string[];
  },
) {
  const { tenantId } = await requireOwner();

  const update: { title?: string; slug?: string; contentHtml?: string; contentCss?: string | null; published?: boolean; userGroups?: { set: { id: string }[] } } = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.slug !== undefined) update.slug = slugify(data.slug);
  if (data.contentHtml !== undefined) update.contentHtml = data.contentHtml;
  if (data.contentCss !== undefined) update.contentCss = data.contentCss;
  if (data.published !== undefined) update.published = data.published;
  if (data.userGroupIds !== undefined) {
    update.userGroups = { set: data.userGroupIds.map((gid) => ({ id: gid })) };
  }

  const page = await prisma.customPage.update({
    where: { id, tenantId },
    data: update,
  });

  logAuditAsync({ action: "update", entityType: "custom_page", entityId: id, metadata: { published: data.published } });
  revalidatePath("/admin/pages");
  revalidatePath(`/p/${page.slug}`);
  return { id: page.id, slug: page.slug };
}

export async function deleteCustomPage(id: string) {
  const { tenantId } = await requireOwner();

  await prisma.customPage.delete({ where: { id, tenantId } });
  logAuditAsync({ action: "delete", entityType: "custom_page", entityId: id });
  revalidatePath("/admin/pages");
}

export async function listCustomPages() {
  const tenantId = getTenantId();
  if (!(await hasFeature("customPages"))) return [];
  return prisma.customPage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { userGroups: { select: { id: true, name: true } } },
  });
}
