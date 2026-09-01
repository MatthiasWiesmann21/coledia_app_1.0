"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updatePost } from "@/lib/content-actions";

type PostData = {
  id: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  imageUrl?: string | null;
  gifUrl?: string | null;
  published: boolean;
  scheduledAt?: string | null;
};

type Category = { id: string; name: string; color: string };

export function PostEditor({
  post,
  categories,
}: {
  post: PostData;
  categories: Category[];
}) {
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description ?? "");
  const [categoryId, setCategoryId] = useState(post.categoryId ?? "");
  const [imageUrl, setImageUrl] = useState(post.imageUrl ?? "");
  const [gifUrl, setGifUrl] = useState(post.gifUrl ?? "");
  const [published, setPublished] = useState(post.published);
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduledAt ? post.scheduledAt.slice(0, 16) : "",
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await updatePost(post.id, {
        title,
        description: description || null,
        categoryId: categoryId || null,
        imageUrl: imageUrl || null,
        gifUrl: gifUrl || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      });
      setMsg("Post saved");
    } catch {
      setMsg("Could not save post");
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await updatePost(post.id, { published: !published });
      setPublished(!published);
      setMsg(!published ? "Post published" : "Post unpublished");
    } catch {
      setMsg("Could not toggle publish");
    }
    setSaving(false);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Content */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Post Content</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description / Content</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="Write your post content here..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gifUrl">GIF URL (optional)</Label>
            <Input
              id="gifUrl"
              type="url"
              value={gifUrl}
              onChange={(e) => setGifUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <Button size="sm" disabled={saving} className="mt-4" onClick={handleSave}>
          {saving ? "Saving..." : "Save Post"}
        </Button>
      </section>

      {/* Scheduling */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Scheduling</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="scheduledAt">Schedule for later (optional)</Label>
          <Input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            Leave empty to publish immediately when you click Publish.
          </p>
        </div>
        <Button size="sm" disabled={saving} className="mt-4" onClick={handleSave}>
          Save Schedule
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Publish</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {published
            ? "This post is live and visible to users."
            : "This post is a draft and not visible to users."}
        </p>
        <Button
          onClick={handlePublish}
          disabled={saving}
          variant={published ? "outline" : "default"}
        >
          {published ? "Unpublish" : "Publish Post"}
        </Button>
      </section>

      {msg && <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>}

      <Link href="/admin/posts" className="text-sm text-[var(--tenant-primary)] hover:underline">
        ← Back to posts
      </Link>
    </div>
  );
}
