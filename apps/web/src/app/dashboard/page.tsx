import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { TermsModal } from "@/components/terms-modal";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  const needsTerms = !profile?.acceptedTermsAt;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <TermsModal userId={session.user.id} needsTerms={needsTerms} />
      <h1 className="text-3xl font-bold text-brand-gradient">Dashboard</h1>
      <p className="text-[var(--muted-foreground)]">
        Welcome back, {session.user.name}!
      </p>
      <p className="text-sm text-[var(--muted-foreground)]">
        The full dashboard will be built in Phase 2.
      </p>
    </main>
  );
}
