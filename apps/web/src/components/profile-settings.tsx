"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { authClient } from "@/lib/auth-client";
import { updateProfile, setActivityStatus, setUserLanguage } from "@/lib/actions";
import { UploadButton } from "@/components/upload-button";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";

export function ProfileSettings({
  initialUsername,
  initialBio,
  initialAvatarUrl,
  initialStatus,
  initialLanguage,
}: {
  initialUsername: string | null;
  initialBio: string | null;
  initialAvatarUrl: string | null;
  initialStatus: string;
  initialLanguage: string;
}) {
  const t = useTranslations("profile");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [language, setLanguage] = useState<Locale>(
    (locales as readonly string[]).includes(initialLanguage)
      ? (initialLanguage as Locale)
      : "en",
  );
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [langMsg, setLangMsg] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingLang, setLoadingLang] = useState(false);

  // Avoid hydration mismatch for theme — next-themes reads localStorage on client only
  useEffect(() => setMounted(true), []);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [loadingPwd, setLoadingPwd] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileMsg(null);
    try {
      await updateProfile({ username, bio, avatarUrl });
      setProfileMsg("Profile saved");
    } catch {
      setProfileMsg("Could not save profile");
    }
    setLoadingProfile(false);
  }

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    setLoadingStatus(true);
    setStatusMsg(null);
    try {
      await setActivityStatus(newStatus);
      setStatusMsg("Status updated");
    } catch {
      setStatusMsg("Could not update status");
    }
    setLoadingStatus(false);
  }

  async function handleLanguageChange(newLang: Locale) {
    setLanguage(newLang);
    setLoadingLang(true);
    setLangMsg(null);
    try {
      await setUserLanguage(newLang);
      setLangMsg("Language updated — reloading...");
      // Full page reload is the most reliable way to force AppShell
      // (which provides NextIntlClientProvider) to re-render with
      // the new locale and messages from the database
      window.location.reload();
    } catch {
      setLangMsg("Could not update language");
    }
    setLoadingLang(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword !== confirmNewPassword) {
      setPwdMsg("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPwdMsg("Password must be at least 8 characters");
      return;
    }

    setLoadingPwd(true);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
    });
    setLoadingPwd(false);

    if (result.error) {
      setPwdMsg(result.error.message ?? "Could not change password");
      return;
    }

    setPwdMsg("Password changed successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  const statuses = [
    { value: "online", label: t("online"), color: "#31a354" },
    { value: "not_available", label: t("notAvailable"), color: "#e6550d" },
    { value: "do_not_disturb", label: t("doNotDisturb"), color: "#dc2626" },
    { value: "invisible", label: t("invisible"), color: "#6b7280" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Profile info */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Profile Information</h2>
        <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Tell us about yourself..."
              className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-2">
            <UploadButton
              category="avatars"
              value={avatarUrl || null}
              onChange={(url) => setAvatarUrl(url ?? "")}
              label="Avatar"
              aspectRatio="square"
              compact
            />
          </div>
          {profileMsg && (
            <p className="text-sm text-muted-foreground">{profileMsg}</p>
          )}
          <Button type="submit" disabled={loadingProfile} className="w-fit">
            {loadingProfile ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </section>

      {/* Activity status */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Activity Status</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                status === s.value
                  ? "border-(--tenant-primary) bg-(--tenant-primary)/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </button>
          ))}
        </div>
        {statusMsg && (
          <p className="text-sm text-muted-foreground">{statusMsg}</p>
        )}
      </section>

      {/* Language */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("language")}</h2>
        <div className="flex flex-wrap gap-2">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLanguageChange(loc)}
              disabled={loadingLang}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                language === loc
                  ? "border-(--tenant-primary) bg-(--tenant-primary)/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span>{localeFlags[loc]}</span>
              {localeNames[loc]}
            </button>
          ))}
        </div>
        {langMsg && (
          <p className="text-sm text-muted-foreground">{langMsg}</p>
        )}
      </section>

      {/* Appearance — theme mode */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTheme("light")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              mounted && theme === "light"
                ? "border-(--tenant-primary) bg-(--tenant-primary)/10"
                : "border-border hover:bg-muted"
            }`}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              mounted && theme === "dark"
                ? "border-(--tenant-primary) bg-(--tenant-primary)/10"
                : "border-border hover:bg-muted"
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Overrides the organization default theme mode. Set by the owner in admin settings.
        </p>
      </section>

      {/* Change password */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmNewPassword">Confirm new password</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {pwdMsg && (
            <p
              className={`text-sm ${
                pwdMsg.includes("successfully")
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {pwdMsg}
            </p>
          )}
          <Button type="submit" disabled={loadingPwd} className="w-fit">
            {loadingPwd ? "Changing..." : "Change password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
