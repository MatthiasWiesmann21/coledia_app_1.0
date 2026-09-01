import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold text-brand-gradient">Dashboard</h1>
      <p className="text-[var(--muted-foreground)]">
        Welcome back, {session?.user?.name ?? "user"}!
      </p>
      <p className="text-sm text-[var(--muted-foreground)]">
        The full dashboard will be built in Phase 2.
      </p>
    </main>
  );
}
