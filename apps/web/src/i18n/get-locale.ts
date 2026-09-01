import { prisma } from "@coledia/db";
import { getSession } from "@/lib/session";
import { defaultLocale, isLocale, type Locale } from "./config";

/**
 * Get the user's preferred language from their UserProfile.
 * Falls back to defaultLocale ("en") if not set or not logged in.
 */
export async function getUserLocale(): Promise<Locale> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return defaultLocale;

    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { language: true },
    });

    if (profile?.language && isLocale(profile.language)) {
      return profile.language;
    }
  } catch {
    // Ignore errors — fall back to default
  }
  return defaultLocale;
}
