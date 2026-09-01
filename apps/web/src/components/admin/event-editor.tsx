"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updateEvent } from "@/lib/content-actions";

type EventData = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  userGroupId?: string | null;
  startAt: string;
  endAt?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  streamChatEnabled: boolean;
  published: boolean;
};

type Category = { id: string; name: string; color: string };
type UserGroup = { id: string; name: string };

export function EventEditor({
  event,
  categories,
  userGroups,
}: {
  event: EventData;
  categories: Category[];
  userGroups: UserGroup[];
}) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(event.thumbnailUrl ?? "");
  const [categoryId, setCategoryId] = useState(event.categoryId ?? "");
  const [userGroupId, setUserGroupId] = useState(event.userGroupId ?? "");
  const [startAt, setStartAt] = useState(event.startAt);
  const [endAt, setEndAt] = useState(event.endAt ?? "");
  const [videoUrl, setVideoUrl] = useState(event.videoUrl ?? "");
  const [videoType, setVideoType] = useState(event.videoType ?? "youtube");
  const [streamChatEnabled, setStreamChatEnabled] = useState(event.streamChatEnabled);
  const [published, setPublished] = useState(event.published);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await updateEvent(event.id, {
        title,
        description: description || null,
        thumbnailUrl: thumbnailUrl || null,
        categoryId: categoryId || null,
        userGroupId: userGroupId || null,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        videoUrl: videoUrl || null,
        videoType: videoType || null,
        streamChatEnabled,
      });
      setMsg("Event saved");
    } catch {
      setMsg("Could not save event");
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await updateEvent(event.id, { published: !published });
      setPublished(!published);
      setMsg(!published ? "Event published" : "Event unpublished");
    } catch {
      setMsg("Could not toggle publish");
    }
    setSaving(false);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Details */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Event Details</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="What is this event about?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
            <Input
              id="thumbnailUrl"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="usergroup">Usergroup (optional)</Label>
              <select
                id="usergroup"
                value={userGroupId}
                onChange={(e) => setUserGroupId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                <option value="">All users</option>
                {userGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startAt">Start Date & Time</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="endAt">End Date & Time (optional)</Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <Button size="sm" disabled={saving} className="mt-4" onClick={handleSave}>
          {saving ? "Saving..." : "Save Details"}
        </Button>
      </section>

      {/* Video / Stream */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Video / Stream</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="videoType">Video Source</Label>
            <select
              id="videoType"
              value={videoType}
              onChange={(e) => setVideoType(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="external">External Link</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={streamChatEnabled}
              onChange={(e) => setStreamChatEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Enable stream chat</span>
          </label>
        </div>
        <Button size="sm" disabled={saving} className="mt-4" onClick={handleSave}>
          Save Video
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Publish</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {published
            ? "This event is visible to users."
            : "This event is a draft and not visible to users."}
        </p>
        <Button
          onClick={handlePublish}
          disabled={saving}
          variant={published ? "outline" : "default"}
        >
          {published ? "Unpublish" : "Publish Event"}
        </Button>
      </section>

      {msg && <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>}

      <Link href="/admin/events" className="text-sm text-[var(--tenant-primary)] hover:underline">
        ← Back to events
      </Link>
    </div>
  );
}
