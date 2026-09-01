import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { ProfileSettings } from "@/components/profile-settings";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-8 text-2xl font-bold">Profile Settings</h1>
      <ProfileSettings
        initialUsername={profile?.username ?? null}
        initialBio={profile?.bio ?? null}
        initialAvatarUrl={profile?.avatarUrl ?? null}
        initialStatus={profile?.status ?? "online"}
      />
    </main>
  );
}
