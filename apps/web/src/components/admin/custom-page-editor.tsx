"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updateCustomPage, deleteCustomPage } from "@/lib/custom-page-actions";
import { useConfirm, useAlert } from "@/components/confirm-provider";

type Page = {
  id: string;
  title: string;
  slug: string;
  contentHtml: string;
  contentCss: string;
  published: boolean;
  userGroupIds: string[];
};

type UserGroup = { id: string; name: string };

export function CustomPageEditor({
  page: initial,
  userGroups,
}: {
  page: Page;
  userGroups: UserGroup[];
}) {
  const [page, setPage] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"html" | "css" | "preview">("html");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const confirm = useConfirm();
  const alert = useAlert();

  // Live preview via srcdoc — CSS is scoped inside the iframe document
  const previewDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${page.contentCss ?? ""}</style></head><body>${page.contentHtml}</body></html>`;

  function save() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateCustomPage(page.id, {
          title: page.title,
          slug: page.slug,
          contentHtml: page.contentHtml,
          contentCss: page.contentCss,
          published: page.published,
          userGroupIds: page.userGroupIds,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function toggleGroup(id: string) {
    setPage((p) => ({
      ...p,
      userGroupIds: p.userGroupIds.includes(id)
        ? p.userGroupIds.filter((g) => g !== id)
        : [...p.userGroupIds, id],
    }));
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this page?",
      description: "This custom page will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteCustomPage(page.id);
        router.push("/admin/pages");
      } catch (e: any) {
        await alert({ title: "Failed to delete", description: e.message });
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved</p>}

      {/* Meta fields */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-1 block text-xs">Title</Label>
          <Input
            type="text"
            value={page.title}
            onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Slug</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">/p/</span>
            <Input
              type="text"
              value={page.slug}
              onChange={(e) => setPage((p) => ({ ...p, slug: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div>
        <Label className="mb-1 block text-xs">Visible to</Label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPage((p) => ({ ...p, userGroupIds: [] }))}
            className={`rounded px-2 py-1 text-xs transition ${page.userGroupIds.length === 0 ? "bg-(--tenant-primary) text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            All members
          </button>
          {userGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => toggleGroup(g.id)}
              className={`rounded px-2 py-1 text-xs transition ${page.userGroupIds.includes(g.id) ? "bg-(--tenant-primary) text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["html", "css", "preview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm uppercase transition ${tab === t ? "border-b-2 border-(--tenant-primary) font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Editors */}
      {tab === "html" && (
        <textarea
          value={page.contentHtml}
          onChange={(e) => setPage((p) => ({ ...p, contentHtml: e.target.value }))}
          className="h-96 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
          spellCheck={false}
        />
      )}
      {tab === "css" && (
        <textarea
          value={page.contentCss}
          onChange={(e) => setPage((p) => ({ ...p, contentCss: e.target.value }))}
          className="h-96 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
          spellCheck={false}
          placeholder="/* Custom CSS — scoped to the page iframe */"
        />
      )}
      {tab === "preview" && (
        <iframe
          ref={iframeRef}
          srcDoc={previewDoc}
          title="Preview"
          sandbox="allow-same-origin"
          className="h-96 w-full rounded-md border border-input bg-white"
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={page.published}
            onChange={(e) => setPage((p) => ({ ...p, published: e.target.checked }))}
            className="h-4 w-4 rounded"
          />
          Published
        </label>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={pending}>
          Delete
        </Button>
      </div>
    </div>
  );
}
