"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId },
    },
  });

  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
    throw new Error("Forbidden");
  }

  return { session, tenantId, membership };
}

// ─── User Management ───────────────────────────────────────────

export async function updateUserRole(userId: string, role: string) {
  const { membership } = await requireAdmin();

  // Only owners can change roles to owner/admin
  if ((role === "owner" || role === "admin") && membership.role !== "owner") {
    throw new Error("Only owners can assign owner/admin roles");
  }

  // Can't change your own role
  if (userId === membership.userId) {
    throw new Error("You cannot change your own role");
  }

  await prisma.membership.update({
    where: {
      userId_tenantId: { userId, tenantId: getTenantId() },
    },
    data: { role },
  });

  revalidatePath("/admin/users");
}

export async function removeUser(userId: string) {
  const { membership } = await requireAdmin();

  if (userId === membership.userId) {
    throw new Error("You cannot remove yourself");
  }

  // Check target isn't an owner
  const target = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId, tenantId: getTenantId() },
    },
  });

  if (target?.role === "owner") {
    throw new Error("Cannot remove an owner");
  }

  await prisma.membership.delete({
    where: {
      userId_tenantId: { userId, tenantId: getTenantId() },
    },
  });

  revalidatePath("/admin/users");
}

// ─── Tenant Settings ───────────────────────────────────────────

export async function updateTenantSettings(data: {
  name?: string;
  status?: string;
  plan?: string;
}) {
  const { tenantId, membership } = await requireAdmin();

  // Only owners can change plan/status
  if ((data.plan || data.status) && membership.role !== "owner") {
    throw new Error("Only owners can change plan or status");
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data,
  });

  revalidatePath("/admin/settings");
}

export async function updateBranding(data: {
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  logoClickUrl?: string | null;
  faviconUrl?: string | null;
  primaryColorLight?: string | null;
  primaryColorDark?: string | null;
  navTextColorLight?: string | null;
  navTextColorDark?: string | null;
  navBgColorLight?: string | null;
  navBgColorDark?: string | null;
  authLogoSignUpLight?: string | null;
  authLogoSignUpDark?: string | null;
  authLogoSignInLight?: string | null;
  authLogoSignInDark?: string | null;
  authLogoForgotLight?: string | null;
  authLogoForgotDark?: string | null;
}) {
  const { tenantId } = await requireAdmin();

  // Upsert branding record
  const existing = await prisma.branding.findUnique({
    where: { tenantId },
  });

  if (existing) {
    await prisma.branding.update({
      where: { tenantId },
      data,
    });
  } else {
    await prisma.branding.create({
      data: { tenantId, ...data },
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard");
  revalidatePath("/courses");
}

// ─── API Keys ──────────────────────────────────────────────────

export async function createApiKey(name: string) {
  const { tenantId } = await requireAdmin();

  // Generate a random API key — returned once, stored as hash
  const rawKey = `col_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`;

  // Simple hash for storage (in production, use bcrypt or similar)
  const keyHash = Buffer.from(rawKey).toString("base64");

  await prisma.apiKey.create({
    data: {
      tenantId,
      name,
      keyHash,
      scopes: JSON.stringify(["read"]),
    },
  });

  revalidatePath("/admin/settings");
  return { key: rawKey }; // Return raw key once for display
}

export async function deleteApiKey(id: string) {
  await requireAdmin();

  await prisma.apiKey.delete({ where: { id } });

  revalidatePath("/admin/settings");
}
