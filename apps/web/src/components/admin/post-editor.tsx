"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updatePost } from "@/lib/content-actions";
import { saveTranslation } from "@/lib/translation-actions";
import { LanguageToggle } from "@/components/admin/language-toggle";
import { UploadButton } from "@/components/upload-button";
import { defaultLocale, type Locale } from "@/i18n/config";

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
type Translations = Record<string, Record<string, string>>;

const TRANSLATABLE_FIELDS = ["title", "description"] as const;

export function PostEditor({
  post,
  categories,
  translations: initialTranslations,
}: {
  post: PostData;
  categories: Category[];
  translations: Translations;
}) {
  const t = useTranslations("posts");
  const tc = useTranslations("common");
  const [activeLanguage, setActiveLanguage] = useState<Locale>(defaultLocale);
  const [allTranslations, setAllTranslations] = useState<Translations>(initialTranslations);
  const [translationEdits, setTranslationEdits] = useState<Record<string, Record<string, string>>>({});

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

  function handleLanguageChange(lang: Locale) {
    if (activeLanguage !== defaultLocale) {
      setTranslationEdits((prev) => ({
        ...prev,
        [activeLanguage]: { ...prev[activeLanguage], title, description },
      }));
    }
    setActiveLanguage(lang);
    if (lang === defaultLocale) {
      setTitle(post.title);
      setDescription(post.description ?? "");
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

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const entityData: Parameters<typeof updatePost>[1] = {
        categoryId: categoryId || null,
        imageUrl: imageUrl || null,
        gifUrl: gifUrl || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      };

      if (activeLanguage === defaultLocale) {
        entityData.title = title;
        entityData.description = description || null;
      }

      await updatePost(post.id, entityData);

      if (activeLanguage !== defaultLocale) {
        await Promise.all([
          saveTranslation({ entityType: "post", entityId: post.id, field: "title", language: activeLanguage, value: title }),
          saveTranslation({ entityType: "post", entityId: post.id, field: "description", language: activeLanguage, value: description }),
        ]);
        setAllTranslations((prev) => ({
          ...prev,
          [activeLanguage]: { ...prev[activeLanguage], title, description },
        }));
      }

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
        <h2 className="mb-4 text-lg font-semibold">{t("editPost")}</h2>

        <LanguageToggle
          activeLanguage={activeLanguage}
          onLanguageChange={handleLanguageChange}
          translatedLanguages={translatedLanguages}
          className="mb-4 border-b border-[var(--border)] pb-4"
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">{tc("title")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{tc("description")}</Label>
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
            <Label htmlFor="category">{t("editPost") === "Edit Post" ? "Category" : tc("title")}</Label>
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
            <UploadButton
              category="post-images"
              value={imageUrl || null}
              onChange={(url) => setImageUrl(url ?? "")}
              label={t("imageUrl")}
              aspectRatio="16/9"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gifUrl">{t("gifUrl")}</Label>
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
          {saving ? tc("loading") : tc("save")}
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
        <h2 className="mb-2 text-lg font-semibold">{tc("publish")}</h2>
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
          {published ? t("unpublishPost") : t("publishPost")}
        </Button>
      </section>

      {msg && <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>}

      <Link href="/admin/posts" className="text-sm text-[var(--tenant-primary)] hover:underline">
        ← Back to posts
      </Link>
    </div>
  );
}
