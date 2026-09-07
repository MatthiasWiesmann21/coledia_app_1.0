"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { createCustomPage, deleteCustomPage } from "@/lib/custom-page-actions";
import { useConfirm, useAlert } from "@/components/confirm-provider";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  createdAt: string;
  userGroups: string[];
};

export function CustomPagesList({ pages: initial }: { pages: PageRow[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const confirm = useConfirm();
  const alert = useAlert();

  async function handleCreate() {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        const res = await createCustomPage({
          title,
          contentHtml: "<h1>New Page</h1>\n<p>Edit this content...</p>",
          published: false,
        });
        router.push(`/admin/pages/${res.id}`);
      } catch (e: any) {
        await alert({ title: "Failed to create page", description: e.message });
      }
    });
  }

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: "Delete this custom page?",
      description: `"${title}" will be permanently removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteCustomPage(id);
        setPages((p) => p.filter((pg) => pg.id !== id));
      } catch (e: any) {
        await alert({ title: "Failed to delete", description: e.message });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create custom pages with raw HTML + CSS. Visible to selected user groups or all members.
        </p>
        <Button onClick={() => setCreating((c) => !c)}>
          New page
        </Button>
      </div>

      {creating && (
        <div className="flex gap-2 rounded-md border border-border p-3">
          <Input
            type="text"
            placeholder="Page title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleCreate}
            disabled={pending || !title.trim()}
          >
            Create
          </Button>
        </div>
      )}

      {pages.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No custom pages yet. Click &quot;New page&quot; to create one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Visibility</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/admin/pages/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <code className="text-xs">{`/p/${p.slug}`}</code>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${p.published ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                      {p.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {p.userGroups.length > 0 ? p.userGroups.join(", ") : "All members"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p.id, p.title)}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
