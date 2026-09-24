"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  LayoutDashboard,
  Newspaper,
  CalendarDays,
  MessageSquare,
  FileText,
  HelpCircle,
  Shield,
  Users,
  FolderTree,
  BarChart3,
  Settings,
  Tag,
  ChevronLeft,
  Lock,
  Award,
  ScrollText,
  FileCode,
} from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";
import { minPlanForFeature, PLAN_DETAILS, type FeatureKey } from "@coledia/shared";

export type PlanFeatures = Record<FeatureKey, boolean>;

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: FeatureKey;
};

const USER_NAV: NavItem[] = [
  { labelKey: "nav.courses", href: "/courses", icon: BookOpen },
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.news", href: "/news", icon: Newspaper },
  { labelKey: "nav.liveEvents", href: "/events", icon: CalendarDays, feature: "liveEvents" },
  { labelKey: "nav.chat", href: "/chat", icon: MessageSquare },
  { labelKey: "nav.documents", href: "/documents", icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  { labelKey: "admin.overview", href: "/admin", icon: LayoutDashboard },
  { labelKey: "admin.courses", href: "/admin/courses", icon: BookOpen },
  { labelKey: "admin.posts", href: "/admin/posts", icon: Newspaper },
  { labelKey: "admin.liveEvents", href: "/admin/events", icon: CalendarDays, feature: "liveEvents" },
  { labelKey: "admin.chat", href: "/admin/chat", icon: MessageSquare },
  { labelKey: "admin.documents", href: "/admin/documents", icon: FileText },
  { labelKey: "admin.categories", href: "/admin/categories", icon: Tag },
  { labelKey: "admin.users", href: "/admin/users", icon: Users },
  { labelKey: "admin.usergroups", href: "/admin/usergroups", icon: FolderTree, feature: "userGroups" },
  { labelKey: "admin.certificates", href: "/admin/certificates", icon: Award, feature: "quizzesCertificates" },
  { labelKey: "admin.analytics", href: "/admin/analytics", icon: BarChart3 },
  { labelKey: "admin.auditLogs", href: "/admin/audit-logs", icon: ScrollText, feature: "auditLogs" },
  { labelKey: "admin.customPages", href: "/admin/pages", icon: FileCode, feature: "customPages" },
  { labelKey: "admin.settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar({
  isAdmin,
  tenantName,
  tenantLogoUrl,
  logoClickUrl,
  planFeatures,
}: {
  isAdmin: boolean;
  tenantName: string;
  tenantLogoUrl?: string | null;
  logoClickUrl?: string | null;
  planFeatures?: PlanFeatures;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const [adminView, setAdminView] = useState(pathname.startsWith("/admin"));

  // In the user view, unsupported plan features are hidden entirely.
  // In the admin view they stay visible (locked) so admins see the upsell.
  const nav = adminView
    ? ADMIN_NAV
    : USER_NAV.filter(
        (item) =>
          item.feature == null ||
          planFeatures == null ||
          planFeatures[item.feature],
      );

  return (
    <aside className="flex h-screen w-58 flex-col border-r border-border bg-card">
      {/* Logo / Branding — contained, no overflow */}
      <div className="flex h-20 shrink-0 items-center justify-center overflow-hidden border-b border-border px-4 py-2">
        <Link
          href={logoClickUrl ?? "/dashboard"}
          className="flex h-full w-full items-center justify-center"
          aria-label={tenantName}
        >
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex aspect-21/9 max-w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted">
              <span className="text-xs text-muted-foreground">Logo</span>
            </div>
          )}
        </Link>
      </div>

      {/* Admin toggle */}
      {isAdmin && (
        <button
          onClick={() => setAdminView(!adminView)}
          className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {adminView ? t("admin.adminView") : t("admin.userView")}
          </span>
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              adminView ? "" : "rotate-180",
            )}
          />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {nav.map((item) => {
            const locked =
              item.feature != null && planFeatures != null && !planFeatures[item.feature];
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/admin" &&
                pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={locked ? `/upgrade?feature=${item.feature}` : item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    locked
                      ? "text-muted-foreground/60 hover:bg-muted"
                      : active
                        ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={locked ? "line-through decoration-muted-foreground/40" : ""}>
                    {t(item.labelKey)}
                  </span>
                  {locked && (
                    <span className="ml-auto flex items-center gap-1">
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {PLAN_DETAILS[minPlanForFeature(item.feature!)].name}
                      </span>
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3">
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/help"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
              {t("nav.help")}
            </Link>
          </li>
          <li>
            <Link
              href="/privacy"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <FileText className="h-4 w-4" />
              {t("nav.privacyPolicy")}
            </Link>
          </li>
        </ul>
        <p className="mt-2 px-3 text-xs text-muted-foreground">
          {t("nav.madeByColedia")}
        </p>
      </div>
    </aside>
  );
}
