"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { Select } from "@coledia/ui/select";
import { updateChapter } from "@/lib/course-actions";
import { saveTranslation } from "@/lib/translation-actions";
import { LanguageToggle } from "@/components/admin/language-toggle";
import { defaultLocale, type Locale } from "@/i18n/config";

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

type Translations = Record<string, Record<string, string>>;

const TRANSLATABLE_FIELDS = ["title", "description"] as const;

export function ChapterEditor({
  chapter,
  translations: initialTranslations,
}: {
  chapter: ChapterData;
  translations: Translations;
}) {
  const tc = useTranslations("common");
  const [activeLanguage, setActiveLanguage] = useState<Locale>(defaultLocale);
  const [allTranslations, setAllTranslations] = useState<Translations>(initialTranslations);
  const [translationEdits, setTranslationEdits] = useState<Record<string, Record<string, string>>>({});

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

  function handleLanguageChange(lang: Locale) {
    if (activeLanguage !== defaultLocale) {
      setTranslationEdits((prev) => ({
        ...prev,
        [activeLanguage]: { ...prev[activeLanguage], title, description },
      }));
    }
    setActiveLanguage(lang);
    if (lang === defaultLocale) {
      setTitle(chapter.title);
      setDescription(chapter.description ?? "");
    } else {
      const cached = translationEdits[lang];
      const stored = allTranslations[lang];
      setTitle(cached?.title ?? stored?.title ?? "");
      setDescription(cached?.description ?? stored?.description ?? "");
    }
  }

  const translatedLanguages = new Set<string>();
  for (const field of TRANSLATABLE_FIELDS) {
    for (const lang of Object.keys(allTranslations)) {
      if (allTranslations[lang]?.[field]) translatedLanguages.add(lang);
    }
  }

  async function handleSaveDetails() {
    setSaving(true);
    setMsg(null);
    try {
      const entityData: Parameters<typeof updateChapter>[1] = {
        duration: duration || null,
        level: level || null,
        author: author || null,
        videoUrl: videoUrl || null,
        videoType: videoType || null,
        accessFree,
      };

      if (activeLanguage === defaultLocale) {
        entityData.title = title;
        entityData.description = description || null;
      }

      await updateChapter(chapter.id, entityData);

      if (activeLanguage !== defaultLocale) {
        await Promise.all([
          saveTranslation({ entityType: "chapter", entityId: chapter.id, field: "title", language: activeLanguage, value: title }),
          saveTranslation({ entityType: "chapter", entityId: chapter.id, field: "description", language: activeLanguage, value: description }),
        ]);
        setAllTranslations((prev) => ({
          ...prev,
          [activeLanguage]: { ...prev[activeLanguage], title, description },
        }));
      }

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

        <LanguageToggle
          activeLanguage={activeLanguage}
          onLanguageChange={handleLanguageChange}
          translatedLanguages={translatedLanguages}
          className="mb-4 border-b border-[var(--border)] pb-4"
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">{tc("title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{tc("description")}</Label>
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
              <Select
                id="level"
                value={level}
                onValueChange={setLevel}
                options={[
                  { value: "", label: "No level" },
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                ]}
              />
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
          {saving ? tc("loading") : tc("save")}
        </Button>
      </section>

      {/* Video */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Video</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="videoType">Video Source</Label>
            <Select
              id="videoType"
              value={videoType}
              onValueChange={setVideoType}
              options={[
                { value: "youtube", label: "YouTube" },
                { value: "vimeo", label: "Vimeo" },
                { value: "upload", label: "Upload (URL)" },
                { value: "external", label: "External Link" },
              ]}
            />
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
          {tc("save")}
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">{tc("publish")}</h2>
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
          {published ? tc("unpublish") : "Publish Chapter"}
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
