import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EyeOff } from "lucide-react";
import { requireMember } from "@/lib/guards";
import { isModuleEnabled, type ModuleKey } from "@/lib/navigation";

/**
 * Route-segment gate for user-facing module pages (used in module layouts).
 * Disabled in Settings → Navigation → 404 for members; admins still get the
 * page with a notice so they can preview/prepare content.
 */
export async function ModuleGate({
  module,
  children,
}: {
  module: ModuleKey;
  children: React.ReactNode;
}) {
  // No member context: AppShell (parent layout) handles sign-in/verification/membership
  const ctx = await requireMember().catch(() => null);
  if (!ctx) return null;
  if (await isModuleEnabled(module, ctx.tenantId)) return <>{children}</>;
  if (!ctx.isAdmin) notFound();

  const t = await getTranslations("navigationSettings");
  return (
    <>
      <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
        <EyeOff className="h-4 w-4 shrink-0" />
        {t("disabledForMembers")}
      </div>
      {children}
    </>
  );
}
