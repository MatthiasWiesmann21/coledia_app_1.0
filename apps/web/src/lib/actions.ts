"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { revalidatePath } from "next/cache";

/**
 * Accept the privacy policy and terms of use.
 * Sets acceptedTermsAt on the user's profile.
 */
export async function acceptTerms() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: { acceptedTermsAt: new Date() },
    create: {
      userId: session.user.id,
      acceptedTermsAt: new Date(),
    },
  });
}

/**
 * Update the user's profile (username, bio, avatar URL, language).
 */
export async function updateProfile(data: {
  username?: string;
  bio?: string;
  avatarUrl?: string;
  language?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: data,
    create: {
      userId: session.user.id,
      ...data,
    },
  });

  // Revalidate pages that display the user's avatar so they pick up the change
  revalidatePath("/chat");
  revalidatePath("/news", "layout");
  revalidatePath("/settings/profile");
}

/**
 * Set the user's preferred language.
 */
export async function setUserLanguage(language: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const validLanguages = ["en", "de", "fr", "es"];
  if (!validLanguages.includes(language)) {
    throw new Error("Invalid language");
  }

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: { language },
    create: {
      userId: session.user.id,
      language,
    },
  });

  // Revalidate all layouts and pages so AppShell re-reads the locale
  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/settings/profile", "page");
}

/**
 * Set the user's activity status.
 */
export async function setActivityStatus(status: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const validStatuses = ["online", "not_available", "do_not_disturb", "invisible"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.userProfile.update({
    where: { userId: session.user.id },
    data: { status },
  });
}

/**
 * Check if the current user has accepted terms.
 * Also returns profile data for the onboarding flow.
 */
export async function getProfileStatus() {
  const session = await getSession();
  if (!session) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  return {
    userId: session.user.id,
    hasProfile: !!profile,
    acceptedTerms: !!profile?.acceptedTermsAt,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    status: profile?.status ?? "online",
  };
}
