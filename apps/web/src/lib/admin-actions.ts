"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { revalidatePath } from "next/cache";
import { validPresetIds } from "@coledia/ui";
import { logAuditAsync } from "./audit";
import { generateApiKey, hashApiKey } from "./api-keys";

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
  logAuditAsync({ action: "role_change", entityType: "user", entityId: userId, metadata: { role } });

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
  logAuditAsync({ action: "delete", entityType: "user", entityId: userId });

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
  logAuditAsync({ action: "settings_change", entityType: "settings", entityId: tenantId, metadata: data });

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
  themePreset?: string | null;
  themeMode?: string | null;
}) {
  const { tenantId, membership } = await requireAdmin();

  // Validate themePreset
  if (data.themePreset !== undefined && data.themePreset !== null) {
    if (!validPresetIds.includes(data.themePreset)) {
      throw new Error("Invalid theme preset");
    }
  }

  // Validate themeMode
  if (data.themeMode !== undefined && data.themeMode !== null) {
    if (!["light", "dark", "system"].includes(data.themeMode)) {
      throw new Error("Invalid theme mode");
    }
  }

  // Only owners can change theme preset or mode
  if (
    (data.themePreset !== undefined || data.themeMode !== undefined) &&
    membership.role !== "owner"
  ) {
    throw new Error("Only owners can change the theme preset or mode");
  }

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
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/courses");
}

// ─── API Keys ──────────────────────────────────────────────────

export async function createApiKey(name: string) {
  const { tenantId } = await requireAdmin();

  // Only org-tier tenants can create API keys
  const { hasFeature } = await import("./plan");
  if (!(await hasFeature("apiAccess"))) {
    throw new Error("API keys require the Organization plan");
  }

  // Generate a random API key — returned once, stored as SHA-256 hash
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);

  await prisma.apiKey.create({
    data: {
      tenantId,
      name,
      keyHash,
      scopes: JSON.stringify(["read"]),
    },
  });
  logAuditAsync({ action: "api_key_create", entityType: "api_key", metadata: { name } });

  revalidatePath("/admin/settings");
  return { key: rawKey }; // Return raw key once for display
}

export async function deleteApiKey(id: string) {
  await requireAdmin();

  await prisma.apiKey.delete({ where: { id } });
  logAuditAsync({ action: "api_key_revoke", entityType: "api_key", entityId: id });

  revalidatePath("/admin/settings");
}
