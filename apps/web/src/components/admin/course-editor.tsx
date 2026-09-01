"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  Circle,
  Video,
} from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import {
  updateCourse,
  createChapter,
  deleteChapter,
} from "@/lib/course-actions";
import { saveTranslation } from "@/lib/translation-actions";
import { LanguageToggle } from "@/components/admin/language-toggle";
import { defaultLocale, type Locale } from "@/i18n/config";

type Chapter = {
  id: string;
  title: string;
  duration?: string | null;
  level?: string | null;
  author?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  accessFree: boolean;
  published: boolean;
  order: number;
};

type CourseData = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  userGroupId?: string | null;
  duration?: string | null;
  level?: string | null;
  specialStatus?: string | null;
  price: number | null;
  published: boolean;
  chapters: Chapter[];
};

type Category = { id: string; name: string; color: string };
type UserGroup = { id: string; name: string };

type Translations = Record<string, Record<string, string>>;

const TRANSLATABLE_FIELDS = ["title", "description"] as const;

export function CourseEditor({
  course,
  categories,
  userGroups,
  translations: initialTranslations,
}: {
  course: CourseData;
  categories: Category[];
  userGroups: UserGroup[];
  translations: Translations;
}) {
  const t = useTranslations("courses");
  const tc = useTranslations("common");
  const [activeLanguage, setActiveLanguage] = useState<Locale>(defaultLocale);
  const [allTranslations, setAllTranslations] = useState<Translations>(initialTranslations);

  // Field state — these hold the CURRENT language's values
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnailUrl ?? "");
  const [categoryId, setCategoryId] = useState(course.categoryId ?? "");
  const [userGroupId, setUserGroupId] = useState(course.userGroupId ?? "");
  const [duration, setDuration] = useState(course.duration ?? "");
  const [level, setLevel] = useState(course.level ?? "");
  const [specialStatus, setSpecialStatus] = useState(course.specialStatus ?? "");
  const [price, setPrice] = useState(course.price?.toString() ?? "");
  const [published, setPublished] = useState(course.published);
  const [chapters, setChapters] = useState(course.chapters);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // New chapter form
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [addingChapter, setAddingChapter] = useState(false);

  // Cache of non-EN language values being edited
  const [translationEdits, setTranslationEdits] = useState<Record<string, Record<string, string>>>({});

  function handleLanguageChange(lang: Locale) {
    // Save current field values to the cache before switching
    if (activeLanguage === defaultLocale) {
      // EN values are in the main state — no need to cache separately
    } else {
      setTranslationEdits((prev) => ({
        ...prev,
        [activeLanguage]: {
          ...prev[activeLanguage],
          title,
          description,
        },
      }));
    }

    setActiveLanguage(lang);

    // Load values for the new language
    if (lang === defaultLocale) {
      setTitle(course.title);
      setDescription(course.description ?? "");
    } else {
      const cached = translationEdits[lang];
      const stored = allTranslations[lang];
      setTitle(cached?.title ?? stored?.title ?? "");
      setDescription(cached?.description ?? stored?.description ?? "");
    }
  }

  // Compute which languages have translations
  const translatedLanguages = new Set<string>();
  for (const field of TRANSLATABLE_FIELDS) {
    for (const lang of Object.keys(allTranslations)) {
      if (allTranslations[lang]?.[field]) {
        translatedLanguages.add(lang);
      }
    }
  }

  async function handleSaveDetails() {
    setSaving(true);
    setMsg(null);
    try {
      // Always save non-translatable fields to the entity
      const entityData: Parameters<typeof updateCourse>[1] = {
        thumbnailUrl: thumbnailUrl || null,
        categoryId: categoryId || null,
        userGroupId: userGroupId || null,
        duration: duration || null,
        level: level || null,
        specialStatus: specialStatus || null,
        price: price ? parseFloat(price) : null,
      };

      if (activeLanguage === defaultLocale) {
        // EN — save title/description directly to the entity
        entityData.title = title;
        entityData.description = description || null;
      }

      await updateCourse(course.id, entityData);

      // If not EN, save translations
      if (activeLanguage !== defaultLocale) {
        await Promise.all([
          saveTranslation({
            entityType: "course",
            entityId: course.id,
            field: "title",
            language: activeLanguage,
            value: title,
          }),
          saveTranslation({
            entityType: "course",
            entityId: course.id,
            field: "description",
            language: activeLanguage,
            value: description,
          }),
        ]);

        // Update local translation cache
        setAllTranslations((prev) => ({
          ...prev,
          [activeLanguage]: {
            ...prev[activeLanguage],
            title,
            description,
          },
        }));
      }

      setMsg(t("details") + " saved");
    } catch {
      setMsg("Could not save course details");
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await updateCourse(course.id, { published: !published });
      setPublished(!published);
      setMsg(!published ? "Course published" : "Course unpublished");
    } catch {
      setMsg("Could not toggle publish");
    }
    setSaving(false);
  }

  async function handleAddChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;
    setAddingChapter(true);
    try {
      const ch = await createChapter({
        courseId: course.id,
        title: newChapterTitle,
      });
      setChapters([...chapters, {
        id: ch.id,
        title: ch.title,
        duration: null,
        level: null,
        author: null,
        videoUrl: null,
        videoType: null,
        accessFree: false,
        published: false,
        order: ch.order,
      }]);
      setNewChapterTitle("");
      setShowAddChapter(false);
    } catch (e) {
      console.error(e);
    }
    setAddingChapter(false);
  }

  async function handleDeleteChapter(id: string) {
    if (!confirm("Delete this chapter?")) return;
    try {
      await deleteChapter(id);
      setChapters(chapters.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Course Details */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("details")}</h2>

        {/* Language toggle */}
        <LanguageToggle
          activeLanguage={activeLanguage}
          onLanguageChange={handleLanguageChange}
          translatedLanguages={translatedLanguages}
          className="mb-4 border-b border-[var(--border)] pb-4"
        />

        {/* Thumbnail preview */}
        {thumbnailUrl && (
          <div className="mb-4 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt="Thumbnail"
              className="h-40 w-full object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="title">{tc("title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="description">{tc("description")}</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="What does this course cover?"
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="thumbnailUrl">{t("thumbnail")}</Label>
            <Input
              id="thumbnailUrl"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Thumbnail upload coming soon. For now, paste an image URL.
            </p>
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="duration">Duration (optional)</Label>
            <Input
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 4 weeks"
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="specialStatus">Special Status (optional)</Label>
            <select
              id="specialStatus"
              value={specialStatus}
              onChange={(e) => setSpecialStatus(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="">None</option>
              <option value="featured">Featured</option>
              <option value="trending">Trending</option>
              <option value="exclusive">Exclusive</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Price (leave empty for free)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
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

      {/* Chapters */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Chapters ({chapters.length})
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddChapter(!showAddChapter)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Chapter
          </Button>
        </div>

        {showAddChapter && (
          <form
            onSubmit={handleAddChapter}
            className="mb-4 flex items-end gap-3 rounded-lg border border-[var(--border)] p-4"
          >
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="newChapter">Chapter Title</Label>
              <Input
                id="newChapter"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="e.g. Introduction"
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={addingChapter}>
              {addingChapter ? "Adding..." : "Add"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddChapter(false)}
            >
              Cancel
            </Button>
          </form>
        )}

        {chapters.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
            No chapters yet. Add one to start building your course.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {chapters.map((ch, i) => (
              <li
                key={ch.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3"
              >
                <GripVertical className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span className="text-sm text-[var(--muted-foreground)]">
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{ch.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    {ch.videoUrl && (
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        Video
                      </span>
                    )}
                    {ch.accessFree && (
                      <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-500">
                        Free Access
                      </span>
                    )}
                    {ch.published ? (
                      <span className="flex items-center gap-1 text-green-500">
                        <CheckCircle2 className="h-3 w-3" />
                        Published
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Circle className="h-3 w-3" />
                        Draft
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/admin/courses/${course.id}/chapters/${ch.id}`}
                  className="rounded-lg px-3 py-1 text-sm text-[var(--tenant-primary)] transition hover:bg-[var(--tenant-primary)]/10"
                >
                  Edit
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteChapter(ch.id)}
                  className="text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Publish</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {published
            ? "This course is live and visible to users."
            : "This course is a draft and not visible to users."}
        </p>
        <Button
          onClick={handlePublish}
          disabled={saving}
          variant={published ? "outline" : "default"}
        >
          {published ? "Unpublish" : "Publish Course"}
        </Button>
      </section>

      {msg && (
        <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>
      )}

      <Link
        href="/admin/courses"
        className="text-sm text-[var(--tenant-primary)] hover:underline"
      >
        ← Back to courses
      </Link>
    </div>
  );
}
