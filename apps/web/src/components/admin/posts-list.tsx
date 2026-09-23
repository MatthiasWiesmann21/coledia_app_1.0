"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { createPost, deletePost } from "@/lib/content-actions";
import { useConfirm } from "@/components/confirm-provider";

type Post = {
  id: string;
  title: string;
  categoryName?: string | null;
  categoryColor?: string | null;
  imageUrl?: string | null;
  published: boolean;
  scheduledAt?: string | null;
  commentCount: number;
  createdAt: string;
};

export function PostsList({ posts }: { posts: Post[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const confirm = useConfirm();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const post = await createPost({ title: newTitle });
      setNewTitle("");
      setShowCreate(false);
      window.location.href = `/admin/posts/${post.id}`;
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this post?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost(id);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => setShowCreate(!showCreate)} className="w-fit" size="sm">
        <Plus className="mr-1 h-4 w-4" />
        Create New Post
      </Button>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="newTitle">Post Title</Label>
            <Input
              id="newTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Welcome to our new platform!"
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
        </form>
      )}

      {posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No posts yet. Create one to share news with your community.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Comments</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-sm">
                    {p.categoryName && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: `${p.categoryColor ?? "#008080"}20`,
                          color: p.categoryColor ?? "#008080",
                        }}
                      >
                        {p.categoryName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.published ? (
                      <span className="flex items-center gap-1 text-sm text-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        Published
                      </span>
                    ) : p.scheduledAt ? (
                      <span className="flex items-center gap-1 text-sm text-orange-500">
                        <Calendar className="h-4 w-4" />
                        Scheduled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                        <Circle className="h-4 w-4" />
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {p.commentCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/admin/posts/${p.id}`}
                          aria-label={`Edit ${p.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p.id)}
                        className="text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
