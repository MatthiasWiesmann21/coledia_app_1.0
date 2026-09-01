"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";

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
 * Update the user's profile (username, bio, avatar URL).
 */
export async function updateProfile(data: {
  username?: string;
  bio?: string;
  avatarUrl?: string;
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
