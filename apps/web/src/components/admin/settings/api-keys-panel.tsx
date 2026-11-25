"use client";

import { useState } from "react";
import { Plus, Trash2, Key, Copy, Check } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { createApiKey, deleteApiKey } from "@/lib/admin-actions";
import { useConfirm } from "@/components/confirm-provider";

type ApiKeyData = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export function ApiKeysPanel({ apiKeys }: { apiKeys: ApiKeyData[] }) {
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const confirm = useConfirm();

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
    const ok = await confirm({
      title: "Delete this API key?",
      description: "Any integrations using this key will stop working immediately.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
      {/* API Keys */}
      <section className="rounded-xl border border-border bg-card p-6">
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
              <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono">
                {newKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyKey}
                className="text-muted-foreground hover:bg-muted"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Copy this key now — it won&apos;t be shown again.
            </p>
          </div>
        )}

        {keyMsg && (
          <p className="mb-4 text-sm text-muted-foreground">{keyMsg}</p>
        )}

        {/* Existing keys */}
        {apiKeys.length > 0 && (
          <ul className="flex flex-col gap-2">
            {apiKeys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
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
