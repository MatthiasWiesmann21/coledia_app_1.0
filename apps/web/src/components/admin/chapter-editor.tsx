"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updateChapter } from "@/lib/course-actions";

type ChapterData = {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  level?: string | null;
  author?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  accessFree: boolean;
  published: boolean;
};

export function ChapterEditor({ chapter }: { chapter: ChapterData }) {
  const [title, setTitle] = useState(chapter.title);
  const [description, setDescription] = useState(chapter.description ?? "");
  const [duration, setDuration] = useState(chapter.duration ?? "");
  const [level, setLevel] = useState(chapter.level ?? "");
  const [author, setAuthor] = useState(chapter.author ?? "");
  const [videoUrl, setVideoUrl] = useState(chapter.videoUrl ?? "");
  const [videoType, setVideoType] = useState(chapter.videoType ?? "youtube");
  const [accessFree, setAccessFree] = useState(chapter.accessFree);
  const [published, setPublished] = useState(chapter.published);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSaveDetails() {
    setSaving(true);
    setMsg(null);
    try {
      await updateChapter(chapter.id, {
        title,
        description: description || null,
        duration: duration || null,
        level: level || null,
        author: author || null,
        videoUrl: videoUrl || null,
        videoType: videoType || null,
        accessFree,
      });
      setMsg("Chapter saved");
    } catch {
      setMsg("Could not save chapter");
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await updateChapter(chapter.id, { published: !published });
      setPublished(!published);
      setMsg(!published ? "Chapter published" : "Chapter unpublished");
    } catch {
      setMsg("Could not toggle publish");
    }
    setSaving(false);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Details */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Chapter Details</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="What does this chapter cover?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration">Duration (optional)</Label>
              <Input
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 15 min"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="level">Level (optional)</Label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                <option value="">No level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="author">Author / Speaker (optional)</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>
        </div>

        <Button
          size="sm"
          disabled={saving}
          className="mt-4"
          onClick={handleSaveDetails}
        >
          {saving ? "Saving..." : "Save Details"}
        </Button>
      </section>

      {/* Video */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Video</h2>
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
              <option value="upload">Upload (URL)</option>
              <option value="external">External Link</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={
                videoType === "youtube"
                  ? "https://youtube.com/watch?v=..."
                  : videoType === "vimeo"
                    ? "https://vimeo.com/..."
                    : "https://..."
              }
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Paste the URL of your video. File upload coming soon.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          disabled={saving}
          className="mt-4"
          onClick={handleSaveDetails}
        >
          Save Video
        </Button>
      </section>

      {/* Access Free */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Access Free</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          If enabled, this chapter is accessible to all users, even if they
          haven&apos;t paid for the course. Useful as a teaser.
        </p>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={accessFree}
            onChange={(e) => setAccessFree(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">Allow free access to this chapter</span>
        </label>
        <Button
          size="sm"
          disabled={saving}
          className="mt-4"
          onClick={handleSaveDetails}
        >
          Save
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Publish</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {published
            ? "This chapter is visible to users."
            : "This chapter is a draft and not visible to users."}
        </p>
        <Button
          onClick={handlePublish}
          disabled={saving}
          variant={published ? "outline" : "default"}
        >
          {published ? "Unpublish" : "Publish Chapter"}
        </Button>
      </section>

      {msg && (
        <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>
      )}

      <Link
        href={`/admin/courses/${chapter.courseId}`}
        className="text-sm text-[var(--tenant-primary)] hover:underline"
      >
        ← Back to course
      </Link>
    </div>
  );
}
