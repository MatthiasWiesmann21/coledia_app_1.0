"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const USER_NAV: NavItem[] = [
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Live Events", href: "/events", icon: CalendarDays },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Documents", href: "/documents", icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Courses", href: "/admin/courses", icon: BookOpen },
  { label: "Posts", href: "/admin/posts", icon: Newspaper },
  { label: "Live Events", href: "/admin/events", icon: CalendarDays },
  { label: "Categories", href: "/admin/categories", icon: Tag },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Usergroups", href: "/admin/usergroups", icon: FolderTree },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
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
  const [adminView, setAdminView] = useState(pathname.startsWith("/admin"));

  const nav = adminView ? ADMIN_NAV : USER_NAV;

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Logo / Branding */}
      <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-4">
        <Link
          href={logoClickUrl ?? "/dashboard"}
          className="flex items-center gap-2"
        >
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-8 w-auto"
            />
          ) : (
            <span className="text-lg font-bold text-brand-gradient">
              {tenantName}
            </span>
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
            {adminView ? "Admin View" : "User View"}
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
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
                  {item.label}
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
              Help
            </Link>
          </li>
          <li>
            <Link
              href="/privacy"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FileText className="h-4 w-4" />
              Privacy Policy
            </Link>
          </li>
        </ul>
        <p className="mt-2 px-3 text-xs text-[var(--muted-foreground)]">
          Made by Coledia
        </p>
      </div>
    </aside>
  );
}
