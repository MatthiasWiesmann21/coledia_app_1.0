import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { ProfileSettings } from "@/components/profile-settings";
import { profileKey } from "@/lib/profile";
import { getTenantId } from "@/lib/tenant";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // Profile of this community only (profiles are per tenant)
  const [profile, branding] = await Promise.all([
    prisma.userProfile.findUnique({
      where: profileKey(session.user.id),
    }),
    prisma.branding.findUnique({
      where: { tenantId: getTenantId() },
      select: { themeLocked: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-8 text-2xl font-bold">Profile Settings</h1>
      <ProfileSettings
        initialUsername={profile?.username ?? null}
        initialBio={profile?.bio ?? null}
        initialAvatarUrl={profile?.avatarUrl ?? null}
        initialStatus={profile?.status ?? "online"}
        initialLanguage={profile?.language ?? "en"}
        themeLocked={branding?.themeLocked ?? false}
      />
    </main>
  );
}
