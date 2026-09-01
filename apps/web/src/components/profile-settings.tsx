"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { authClient } from "@/lib/auth-client";
import { updateProfile, setActivityStatus, setUserLanguage } from "@/lib/actions";
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
      setLangMsg("Language updated — reload to see changes");
      // Reload the page to apply the new locale
      setTimeout(() => window.location.reload(), 500);
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
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Avatar upload coming soon. For now, paste an image URL.
            </p>
          </div>
          {profileMsg && (
            <p className="text-sm text-[var(--muted-foreground)]">{profileMsg}</p>
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
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10"
                  : "border-[var(--border)] hover:bg-[var(--muted)]"
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
          <p className="text-sm text-[var(--muted-foreground)]">{statusMsg}</p>
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
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10"
                  : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              <span>{localeFlags[loc]}</span>
              {localeNames[loc]}
            </button>
          ))}
        </div>
        {langMsg && (
          <p className="text-sm text-[var(--muted-foreground)]">{langMsg}</p>
        )}
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
