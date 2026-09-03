import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();

  // Fetch tenant + branding + profile + membership in parallel
  const [tenant, profile, membership] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: session.user.id,
          tenantId,
        },
      },
    }),
  ]);

  if (!tenant) {
    redirect("/sign-in");
  }

  const locale: Locale =
    profile?.language && isLocale(profile.language) ? profile.language : defaultLocale;
  const messages = await getMessages(locale);

  // If user hasn't accepted terms, they stay on dashboard which shows the modal
  // If user hasn't completed profile, redirect to complete-profile
  // (but only if they've already accepted terms — terms take priority)
  if (profile?.acceptedTermsAt && !profile.username && !profile.bio) {
    // Only redirect if they haven't set username AND bio
    // They might have skipped — check if they've visited before
    // For now, we let them through. The complete-profile page is linked from the modal.
  }

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin" || membership?.role === "operator";
  const isOwner = membership?.role === "owner";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Sidebar
          isAdmin={isAdmin}
          tenantName={tenant.name}
          tenantLogoUrl={tenant.branding?.logoLightUrl ?? tenant.branding?.logoDarkUrl}
          logoClickUrl={tenant.branding?.logoClickUrl ?? null}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNav
            userName={session.user.name ?? "User"}
            userEmail={session.user.email}
            userAvatarUrl={profile?.avatarUrl ?? null}
            userStatus={profile?.status ?? "online"}
            isAdmin={isAdmin}
            isOwner={isOwner}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
