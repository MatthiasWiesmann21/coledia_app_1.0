"use client";

import { useState } from "react";
import { Plus, Trash2, Key, Copy, Check } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import {
  updateTenantSettings,
  updateBranding,
  createApiKey,
  deleteApiKey,
} from "@/lib/admin-actions";

type BrandingData = {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  logoClickUrl: string | null;
  faviconUrl: string | null;
  primaryColorLight: string | null;
  primaryColorDark: string | null;
  navTextColorLight: string | null;
  navTextColorDark: string | null;
  navBgColorLight: string | null;
  navBgColorDark: string | null;
};

type ApiKeyData = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export function SettingsPanel({
  tenant,
  branding,
  apiKeys,
}: {
  tenant: { name: string; status: string; plan: string };
  branding: BrandingData | null;
  apiKeys: ApiKeyData[];
}) {
  const [name, setName] = useState(tenant.name);
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantMsg, setTenantMsg] = useState<string | null>(null);

  // Branding state
  const [b, setB] = useState({
    logoLightUrl: branding?.logoLightUrl ?? "",
    logoDarkUrl: branding?.logoDarkUrl ?? "",
    logoClickUrl: branding?.logoClickUrl ?? "",
    faviconUrl: branding?.faviconUrl ?? "",
    primaryColorLight: branding?.primaryColorLight ?? "#008080",
    primaryColorDark: branding?.primaryColorDark ?? "#008080",
    navTextColorLight: branding?.navTextColorLight ?? "#0c2340",
    navTextColorDark: branding?.navTextColorDark ?? "#f4f6f8",
    navBgColorLight: branding?.navBgColorLight ?? "#ffffff",
    navBgColorDark: branding?.navBgColorDark ?? "#1a1a2e",
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState<string | null>(null);

  // API key state
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  async function handleSaveTenant() {
    setSavingTenant(true);
    setTenantMsg(null);
    try {
      await updateTenantSettings({ name });
      setTenantMsg("Tenant settings saved");
    } catch {
      setTenantMsg("Could not save tenant settings");
    }
    setSavingTenant(false);
  }

  async function handleSaveBranding() {
    setSavingBranding(true);
    setBrandingMsg(null);
    try {
      await updateBranding({
        logoLightUrl: b.logoLightUrl || null,
        logoDarkUrl: b.logoDarkUrl || null,
        logoClickUrl: b.logoClickUrl || null,
        faviconUrl: b.faviconUrl || null,
        primaryColorLight: b.primaryColorLight || null,
        primaryColorDark: b.primaryColorDark || null,
        navTextColorLight: b.navTextColorLight || null,
        navTextColorDark: b.navTextColorDark || null,
        navBgColorLight: b.navBgColorLight || null,
        navBgColorDark: b.navBgColorDark || null,
      });
      setBrandingMsg("Branding saved");
    } catch {
      setBrandingMsg("Could not save branding");
    }
    setSavingBranding(false);
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setKeyMsg(null);
    try {
      const result = await createApiKey(newKeyName);
      setNewKey(result.key);
      setNewKeyName("");
      setKeyMsg("API key created — copy it now, it won't be shown again");
    } catch {
      setKeyMsg("Could not create API key");
    }
    setCreatingKey(false);
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("Delete this API key?")) return;
    try {
      await deleteApiKey(id);
    } catch {
      setKeyMsg("Could not delete API key");
    }
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {/* Tenant info */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Tenant Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Tenant Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Plan</Label>
            <div className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm capitalize">
              {tenant.plan}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <div className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm capitalize">
              {tenant.status}
            </div>
          </div>
        </div>
        <Button size="sm" disabled={savingTenant} className="mt-4" onClick={handleSaveTenant}>
          {savingTenant ? "Saving..." : "Save Tenant"}
        </Button>
        {tenantMsg && (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{tenantMsg}</p>
        )}
      </section>

      {/* Branding */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Branding & Design</h2>

        {/* Logos */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold">Logos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="logoLightUrl">Logo (Light Mode)</Label>
              <Input
                id="logoLightUrl"
                type="url"
                value={b.logoLightUrl}
                onChange={(e) => setB({ ...b, logoLightUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="logoDarkUrl">Logo (Dark Mode)</Label>
              <Input
                id="logoDarkUrl"
                type="url"
                value={b.logoDarkUrl}
                onChange={(e) => setB({ ...b, logoDarkUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="logoClickUrl">Logo Click URL</Label>
              <Input
                id="logoClickUrl"
                value={b.logoClickUrl}
                onChange={(e) => setB({ ...b, logoClickUrl: e.target.value })}
                placeholder="/dashboard"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="faviconUrl">Favicon URL</Label>
              <Input
                id="faviconUrl"
                type="url"
                value={b.faviconUrl}
                onChange={(e) => setB({ ...b, faviconUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold">Colors</h3>
          <div className="grid grid-cols-2 gap-4">
            <ColorInput
              label="Primary Color (Light)"
              value={b.primaryColorLight}
              onChange={(v) => setB({ ...b, primaryColorLight: v })}
            />
            <ColorInput
              label="Primary Color (Dark)"
              value={b.primaryColorDark}
              onChange={(v) => setB({ ...b, primaryColorDark: v })}
            />
            <ColorInput
              label="Nav Text (Light)"
              value={b.navTextColorLight}
              onChange={(v) => setB({ ...b, navTextColorLight: v })}
            />
            <ColorInput
              label="Nav Text (Dark)"
              value={b.navTextColorDark}
              onChange={(v) => setB({ ...b, navTextColorDark: v })}
            />
            <ColorInput
              label="Nav Background (Light)"
              value={b.navBgColorLight}
              onChange={(v) => setB({ ...b, navBgColorLight: v })}
            />
            <ColorInput
              label="Nav Background (Dark)"
              value={b.navBgColorDark}
              onChange={(v) => setB({ ...b, navBgColorDark: v })}
            />
          </div>
        </div>

        <Button size="sm" disabled={savingBranding} onClick={handleSaveBranding}>
          {savingBranding ? "Saving..." : "Save Branding"}
        </Button>
        {brandingMsg && (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{brandingMsg}</p>
        )}
      </section>

      {/* API Keys */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">API Keys</h2>

        {/* Create new key */}
        <div className="mb-4 flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="newKeyName">New API Key Name</Label>
            <Input
              id="newKeyName"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. Mobile App"
            />
          </div>
          <Button size="sm" disabled={creatingKey || !newKeyName.trim()} onClick={handleCreateKey}>
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Button>
        </div>

        {/* New key display */}
        {newKey && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-500">
              <Key className="h-4 w-4" />
              Your new API key:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-[var(--background)] px-3 py-2 text-sm font-mono">
                {newKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyKey}
                className="text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Copy this key now — it won&apos;t be shown again.
            </p>
          </div>
        )}

        {keyMsg && (
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">{keyMsg}</p>
        )}

        {/* Existing keys */}
        {apiKeys.length > 0 && (
          <ul className="flex flex-col gap-2">
            {apiKeys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteKey(k.id)}
                  className="text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-[var(--border)]"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      </div>
    </div>
  );
}
