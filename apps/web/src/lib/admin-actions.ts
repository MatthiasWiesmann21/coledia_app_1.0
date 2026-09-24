"use server";

import { prisma } from "@coledia/db";
import { ROLES, type Role } from "@coledia/shared";
import { revalidatePath } from "next/cache";
import { validPresetIds } from "@coledia/ui";
import { logAuditAsync } from "./audit";
import { generateApiKey, hashApiKey } from "./api-keys";
import { requireAdminAction } from "./guards";

const VALID_ROLES = Object.values(ROLES) as string[];

// ─── User Management ───────────────────────────────────────────

export async function updateUserRole(userId: string, role: string) {
  const { membership, tenantId } = await requireAdminAction();

  if (!VALID_ROLES.includes(role)) {
    throw new Error("Invalid role");
  }

  // Can't change your own role
  if (userId === membership.userId) {
    throw new Error("You cannot change your own role");
  }

  const target = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!target) throw new Error("User is not a member of this community");

  const isOwner = (membership.role as Role) === ROLES.OWNER;
  const privileged: string[] = [ROLES.OWNER, ROLES.ADMIN];

  // Only owners can grant owner/admin, or change an existing owner/admin
  if ((privileged.includes(role) || privileged.includes(target.role)) && !isOwner) {
    throw new Error("Only owners can change owner/admin roles");
  }

  // Never leave the tenant without an owner
  if (target.role === ROLES.OWNER && role !== ROLES.OWNER) {
    const owners = await prisma.membership.count({
      where: { tenantId, role: ROLES.OWNER },
    });
    if (owners <= 1) throw new Error("The community must keep at least one owner");
  }

  await prisma.membership.update({
    where: { userId_tenantId: { userId, tenantId } },
    data: { role },
  });
  logAuditAsync({ action: "role_change", entityType: "user", entityId: userId, metadata: { role, previous: target.role } });

  revalidatePath("/admin/users");
}

export async function removeUser(userId: string) {
  const { membership, tenantId } = await requireAdminAction();

  if (userId === membership.userId) {
    throw new Error("You cannot remove yourself");
  }

  const target = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!target) throw new Error("User is not a member of this community");

  if (target.role === ROLES.OWNER) {
    throw new Error("Cannot remove an owner");
  }
  if (target.role === ROLES.ADMIN && membership.role !== ROLES.OWNER) {
    throw new Error("Only owners can remove admins");
  }

  await prisma.membership.delete({
    where: { userId_tenantId: { userId, tenantId } },
  });
  logAuditAsync({ action: "delete", entityType: "user", entityId: userId });

  revalidatePath("/admin/users");
}

// ─── Tenant Settings ───────────────────────────────────────────

/**
 * Update tenant settings. Plan and status are intentionally NOT editable here —
 * they are managed exclusively by the Coledia Controlcenter (internal API).
 */
export async function updateTenantSettings(data: { name?: string }) {
  const { tenantId } = await requireAdminAction();

  const name = data.name?.trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name is too long");

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { name },
  });
  logAuditAsync({ action: "settings_change", entityType: "settings", entityId: tenantId, metadata: { name } });

  revalidatePath("/admin/settings");
}

const COLOR_FIELDS = [
  "primaryColorLight",
  "primaryColorDark",
  "navTextColorLight",
  "navTextColorDark",
  "navBgColorLight",
  "navBgColorDark",
] as const;

const URL_FIELDS = [
  "logoLightUrl",
  "logoDarkUrl",
  "logoClickUrl",
  "faviconUrl",
  "authLogoSignUpLight",
  "authLogoSignUpDark",
  "authLogoSignInLight",
  "authLogoSignInDark",
  "authLogoForgotLight",
  "authLogoForgotDark",
] as const;

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

/** Allow only http(s) URLs or same-origin relative paths (blocks javascript:, data:). */
function isSafeUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
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
  const { tenantId, membership } = await requireAdminAction();

  for (const field of COLOR_FIELDS) {
    const v = data[field];
    if (v && !HEX_COLOR.test(v)) throw new Error(`Invalid color for ${field}`);
  }
  for (const field of URL_FIELDS) {
    const v = data[field];
    if (v && !isSafeUrl(v)) throw new Error(`Invalid URL for ${field}`);
  }

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

  await prisma.branding.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/courses");
}

// ─── API Keys ──────────────────────────────────────────────────

export async function createApiKey(name: string) {
  const { tenantId } = await requireAdminAction();

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
  const { tenantId } = await requireAdminAction();

  const { count } = await prisma.apiKey.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error("API key not found");
  logAuditAsync({ action: "api_key_revoke", entityType: "api_key", entityId: id });

  revalidatePath("/admin/settings");
}
