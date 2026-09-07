"use client";

import { useState, useTransition } from "react";
import { Button } from "@coledia/ui/button";
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
} from "@/lib/webhook-actions";
import { useConfirm } from "@/components/confirm-provider";

type Webhook = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
};

const AVAILABLE_EVENTS = [
  "course.created",
  "course.updated",
  "course.deleted",
  "post.created",
  "post.updated",
  "post.deleted",
  "event.created",
  "event.updated",
  "event.deleted",
  "user.enrolled",
  "user.joined",
  "user.removed",
  "payment.succeeded",
  "payment.refunded",
  "certificate.issued",
];

export function WebhookManager({
  webhooks: initial,
  apiAccess,
}: {
  webhooks: Webhook[];
  apiAccess: boolean;
}) {
  const [webhooks, setWebhooks] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  if (!apiAccess) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Webhooks</h3>
        <p className="text-sm text-muted-foreground">
          Webhooks are available on the Organization plan only.
        </p>
      </div>
    );
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createWebhook({ url: newUrl, events: newEvents });
        setRevealedSecrets((s) => ({ ...s, [res.id]: res.secret }));
        setWebhooks((w) => [
          ...w,
          {
            id: res.id,
            url: newUrl,
            events: newEvents,
            secret: res.secret,
            active: true,
            createdAt: new Date().toISOString(),
          },
        ]);
        setNewUrl("");
        setNewEvents([]);
        setShowForm(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      await updateWebhook(id, { active: !active });
      setWebhooks((w) => w.map((h) => (h.id === id ? { ...h, active: !active } : h)));
    });
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this webhook?",
      description: "The webhook endpoint will stop receiving events.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteWebhook(id);
      setWebhooks((w) => w.filter((h) => h.id !== id));
    });
  }

  async function handleRotate(id: string) {
    const ok = await confirm({
      title: "Rotate webhook secret?",
      description: "The old secret will stop working immediately. You'll receive a new secret to save.",
      confirmLabel: "Rotate secret",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await rotateWebhookSecret(id);
      setRevealedSecrets((s) => ({ ...s, [id]: res.secret }));
      setWebhooks((w) => w.map((h) => (h.id === id ? { ...h, secret: res.secret } : h)));
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Webhooks</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancel" : "Add webhook"}
        </Button>
      </div>

      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-md border border-border p-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Endpoint URL</label>
            <input
              type="url"
              placeholder="https://example.com/webhook"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Events</label>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_EVENTS.map((ev) => (
                <button
                  key={ev}
                  onClick={() => toggleEvent(ev)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    newEvents.includes(ev)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={pending || !newUrl || newEvents.length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
          >
            Create
          </button>
        </div>
      )}

      {webhooks.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No webhooks configured.</p>
      )}

      <div className="space-y-3">
        {webhooks.map((h) => (
          <div key={h.id} className="rounded-md border border-border p-3">
            <div className="mb-1 flex items-center justify-between">
              <code className="text-xs">{h.url}</code>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(h.id, h.active)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    h.active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {h.active ? "Active" : "Paused"}
                </button>
                <button
                  onClick={() => handleRotate(h.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Rotate secret
                </button>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {h.events.map((ev) => (
                <span key={ev} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {ev}
                </span>
              ))}
            </div>
            {revealedSecrets[h.id] && (
              <div className="rounded bg-amber-100 p-2 text-xs dark:bg-amber-950">
                <p className="mb-1 font-semibold text-amber-700 dark:text-amber-300">
                  Save this secret — it won&apos;t be shown again:
                </p>
                <code className="break-all">{revealedSecrets[h.id]}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
