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
} from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const USER_NAV: NavItem[] = [
  { labelKey: "nav.courses", href: "/courses", icon: BookOpen },
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.news", href: "/news", icon: Newspaper },
  { labelKey: "nav.liveEvents", href: "/events", icon: CalendarDays },
  { labelKey: "nav.chat", href: "/chat", icon: MessageSquare },
  { labelKey: "nav.documents", href: "/documents", icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  { labelKey: "admin.overview", href: "/admin", icon: LayoutDashboard },
  { labelKey: "admin.courses", href: "/admin/courses", icon: BookOpen },
  { labelKey: "admin.posts", href: "/admin/posts", icon: Newspaper },
  { labelKey: "admin.liveEvents", href: "/admin/events", icon: CalendarDays },
  { labelKey: "admin.documents", href: "/admin/documents", icon: FileText },
  { labelKey: "admin.categories", href: "/admin/categories", icon: Tag },
  { labelKey: "admin.users", href: "/admin/users", icon: Users },
  { labelKey: "admin.usergroups", href: "/admin/usergroups", icon: FolderTree },
  { labelKey: "admin.analytics", href: "/admin/analytics", icon: BarChart3 },
  { labelKey: "admin.settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar({
  isAdmin,
  tenantName,
  tenantLogoUrl,
  logoClickUrl,
}: {
  isAdmin: boolean;
  tenantName: string;
  tenantLogoUrl?: string | null;
  logoClickUrl?: string | null;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const [adminView, setAdminView] = useState(pathname.startsWith("/admin"));

  const nav = adminView ? ADMIN_NAV : USER_NAV;

  return (
    <aside className="flex h-screen w-58 flex-col border-r border-border bg-card">
      {/* Logo / Branding — 16:9 custom logo placeholder */}
      <div className="flex h-20 items-center justify-center border-b border-border px-4 py-2">
        <Link
          href={logoClickUrl ?? "/dashboard"}
          className="block w-full"
          aria-label={tenantName}
        >
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-full w-full max-w-[140px] object-contain"
            />
          ) : (
            <div className="mx-auto flex aspect-21/9 w-full max-w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted">
              <span className="text-xs text-muted-foreground">Logo</span>
            </div>
          )}
        </Link>
      </div>

      {/* Admin toggle */}
      {isAdmin && (
        <button
          onClick={() => setAdminView(!adminView)}
          className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--muted)]"
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
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/admin" &&
                pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-3 py-3">
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/help"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <HelpCircle className="h-4 w-4" />
              {t("nav.help")}
            </Link>
          </li>
          <li>
            <Link
              href="/privacy"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FileText className="h-4 w-4" />
              {t("nav.privacyPolicy")}
            </Link>
          </li>
        </ul>
        <p className="mt-2 px-3 text-xs text-[var(--muted-foreground)]">
          {t("nav.madeByColedia")}
        </p>
      </div>
    </aside>
  );
}
