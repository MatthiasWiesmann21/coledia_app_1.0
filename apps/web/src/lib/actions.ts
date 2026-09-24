"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { requireMember } from "./guards";
import { profileKey } from "./profile";

/**
 * Profile actions. Profiles are per tenant — every action reads/writes the
 * current user's profile in THIS container only.
 */

const VALID_LANGUAGES = ["en", "de", "fr", "es"];
const VALID_STATUSES = ["online", "not_available", "do_not_disturb", "invisible"];
const USERNAME = /^[a-z0-9_.-]{3,30}$/i;

/**
 * Accept the privacy policy and terms of use of this community.
 * Sets acceptedTermsAt on the user's profile in the current tenant.
 */
export async function acceptTerms() {
  const { userId, tenantId } = await requireMember();

  await prisma.userProfile.upsert({
    where: profileKey(userId, tenantId),
    update: { acceptedTermsAt: new Date() },
    create: { userId, tenantId, acceptedTermsAt: new Date() },
  });
}

/** Allow http(s) URLs or files uploaded to this tenant's storage. */
function isSafeAvatarUrl(url: string, tenantId: string): boolean {
  if (url.startsWith(`/api/uploads/${tenantId}/`)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Update the user's profile (username, bio, avatar URL, language) in the
 * current tenant.
 */
export async function updateProfile(data: {
  username?: string;
  bio?: string;
  avatarUrl?: string;
  language?: string;
}) {
  const { userId, tenantId } = await requireMember();

  const update: { username?: string | null; bio?: string | null; avatarUrl?: string | null; language?: string } = {};

  if (data.username !== undefined) {
    const username = data.username.trim();
    if (username && !USERNAME.test(username)) {
      throw new Error("Username must be 3–30 characters (letters, numbers, . _ -)");
    }
    if (username) {
      const taken = await prisma.userProfile.findFirst({
        where: { tenantId, username, NOT: { userId } },
        select: { id: true },
      });
      if (taken) throw new Error("This username is already taken in this community");
    }
    update.username = username || null;
  }
  if (data.bio !== undefined) {
    if (data.bio.length > 1000) throw new Error("Bio is too long (max 1000 characters)");
    update.bio = data.bio.trim() || null;
  }
  if (data.avatarUrl !== undefined) {
    if (data.avatarUrl && !isSafeAvatarUrl(data.avatarUrl, tenantId)) {
      throw new Error("Invalid avatar URL");
    }
    update.avatarUrl = data.avatarUrl || null;
  }
  if (data.language !== undefined) {
    if (!VALID_LANGUAGES.includes(data.language)) throw new Error("Invalid language");
    update.language = data.language;
  }

  await prisma.userProfile.upsert({
    where: profileKey(userId, tenantId),
    update,
    create: { userId, tenantId, ...update },
  });

  // Revalidate pages that display the user's avatar so they pick up the change
  revalidatePath("/chat");
  revalidatePath("/news", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
}

/**
 * Set the user's preferred language (in this community).
 */
export async function setUserLanguage(language: string) {
  const { userId, tenantId } = await requireMember();

  if (!VALID_LANGUAGES.includes(language)) {
    throw new Error("Invalid language");
  }

  await prisma.userProfile.upsert({
    where: profileKey(userId, tenantId),
    update: { language },
    create: { userId, tenantId, language },
  });

  // Revalidate all layouts and pages so AppShell re-reads the locale
  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/settings/profile", "page");
}

/**
 * Set the user's activity status (in this community).
 */
export async function setActivityStatus(status: string) {
  const { userId, tenantId } = await requireMember();

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.userProfile.upsert({
    where: profileKey(userId, tenantId),
    update: { status },
    create: { userId, tenantId, status },
  });
}

/**
 * Check if the current user has accepted terms in this community.
 * Also returns profile data for the onboarding flow.
 */
export async function getProfileStatus() {
  const ctx = await requireMember().catch(() => null);
  if (!ctx) return null;

  const profile = await prisma.userProfile.findUnique({
    where: profileKey(ctx.userId, ctx.tenantId),
  });

  return {
    userId: ctx.userId,
    hasProfile: !!profile,
    acceptedTerms: !!profile?.acceptedTermsAt,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    status: profile?.status ?? "online",
  };
}
