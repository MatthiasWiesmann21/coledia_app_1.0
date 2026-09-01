"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sun, Moon, Globe, LogOut, User, CreditCard, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { cn } from "@coledia/ui/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  online: "#31a354",
  not_available: "#e6550d",
  do_not_disturb: "#dc2626",
  invisible: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  not_available: "Not Available",
  do_not_disturb: "Do Not Disturb",
  invisible: "Invisible",
};

export function TopNav({
  userName,
  userEmail,
  userAvatarUrl,
  userStatus,
  isAdmin,
  isOwner,
  tenantName,
  tenantLogoUrl,
  logoClickUrl,
}: {
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  userStatus: string;
  isAdmin: boolean;
  isOwner: boolean;
  tenantName: string;
  tenantLogoUrl?: string | null;
  logoClickUrl?: string | null;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4">
      {/* Left: clickable logo */}
      <div className="flex items-center gap-3">
        <Link
          href={logoClickUrl ?? "/dashboard"}
          className="flex items-center gap-2"
        >
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogoUrl} alt={tenantName} className="h-7 w-auto" />
          ) : (
            <span className="text-base font-bold text-brand-gradient">
              {tenantName}
            </span>
          )}
        </Link>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div ref={langRef} className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1 rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Language"
          >
            <Globe className="h-4 w-4" />
            <span className="text-sm">EN</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
              {["EN", "DE", "FR", "ES"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLangOpen(false)}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm transition hover:bg-[var(--muted)]",
                    lang === "EN"
                      ? "text-[var(--tenant-primary)]"
                      : "text-[var(--muted-foreground)]",
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Admin button */}
        {isAdmin && (
          <Link
            href="/admin/courses"
            className="rounded-lg bg-[var(--tenant-primary)]/15 px-3 py-1.5 text-sm font-medium text-[var(--tenant-primary)] transition hover:bg-[var(--tenant-primary)]/25"
          >
            Admin
          </Link>
        )}

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-[var(--muted)]"
          >
            <div className="relative">
              {userAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userAvatarUrl}
                  alt={userName}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-sm font-medium text-white">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--card)]"
                style={{ backgroundColor: STATUS_COLORS[userStatus] ?? "#31a354" }}
              />
            </div>
            <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
              {/* User info */}
              <div className="border-b border-[var(--border)] px-3 py-2">
                <p className="text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {userEmail}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: STATUS_COLORS[userStatus] ?? "#31a354",
                    }}
                  />
                  {STATUS_LABELS[userStatus] ?? "Online"}
                </p>
              </div>

              {/* Menu items */}
              <Link
                href="/settings/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-[var(--muted)]"
              >
                <User className="h-4 w-4" />
                Manage Account
              </Link>

              {isOwner && (
                <Link
                  href="/billing"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-[var(--muted)]"
                >
                  <CreditCard className="h-4 w-4" />
                  Billing
                </Link>
              )}

              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-sm text-red-500 transition hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
