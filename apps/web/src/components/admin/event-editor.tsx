"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { Select } from "@coledia/ui/select";
import { updateEvent } from "@/lib/content-actions";
import { saveTranslation } from "@/lib/translation-actions";
import { LanguageToggle } from "@/components/admin/language-toggle";
import { UploadButton } from "@/components/upload-button";
import { UserGroupMultiSelect } from "@/components/admin/usergroup-multiselect";
import { defaultLocale, type Locale } from "@/i18n/config";

type EventData = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  userGroupIds?: string[];
  startAt: string;
  endAt?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  streamChatEnabled: boolean;
  published: boolean;
};

type Category = { id: string; name: string; color: string };
type UserGroup = { id: string; name: string };
type Translations = Record<string, Record<string, string>>;

const TRANSLATABLE_FIELDS = ["title", "description"] as const;

export function EventEditor({
  event,
  categories,
  userGroups,
  translations: initialTranslations,
}: {
  event: EventData;
  categories: Category[];
  userGroups: UserGroup[];
  translations: Translations;
}) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const [activeLanguage, setActiveLanguage] = useState<Locale>(defaultLocale);
  const [allTranslations, setAllTranslations] = useState<Translations>(initialTranslations);
  const [translationEdits, setTranslationEdits] = useState<Record<string, Record<string, string>>>({});

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(event.thumbnailUrl ?? "");
  const [categoryId, setCategoryId] = useState(event.categoryId ?? "");
  const [userGroupIds, setUserGroupIds] = useState<string[]>(event.userGroupIds ?? []);
  const [startAt, setStartAt] = useState(event.startAt);
  const [endAt, setEndAt] = useState(event.endAt ?? "");
  const [videoUrl, setVideoUrl] = useState(event.videoUrl ?? "");
  const [videoType, setVideoType] = useState(event.videoType ?? "youtube");
  const [streamChatEnabled, setStreamChatEnabled] = useState(event.streamChatEnabled);
  const [published, setPublished] = useState(event.published);
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
      setTitle(event.title);
      setDescription(event.description ?? "");
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
      const entityData: Parameters<typeof updateEvent>[1] = {
        thumbnailUrl: thumbnailUrl || null,
        categoryId: categoryId || null,
        userGroupIds,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        videoUrl: videoUrl || null,
        videoType: videoType || null,
        streamChatEnabled,
      };

      if (activeLanguage === defaultLocale) {
        entityData.title = title;
        entityData.description = description || null;
      }

      await updateEvent(event.id, entityData);

      if (activeLanguage !== defaultLocale) {
        await Promise.all([
          saveTranslation({ entityType: "event", entityId: event.id, field: "title", language: activeLanguage, value: title }),
          saveTranslation({ entityType: "event", entityId: event.id, field: "description", language: activeLanguage, value: description }),
        ]);
        setAllTranslations((prev) => ({
          ...prev,
          [activeLanguage]: { ...prev[activeLanguage], title, description },
        }));
      }

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
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("editEvent")}</h2>

        <LanguageToggle
          activeLanguage={activeLanguage}
          onLanguageChange={handleLanguageChange}
          translatedLanguages={translatedLanguages}
          className="mb-4 border-b border-border pb-4"
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
              rows={4}
              className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="What is this event about?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <UploadButton
              category="event-thumbnails"
              value={thumbnailUrl || null}
              onChange={(url) => setThumbnailUrl(url ?? "")}
              label={t("thumbnail")}
              aspectRatio="16/9"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">{t("category")}</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>User Groups</Label>
              <UserGroupMultiSelect
                userGroups={userGroups}
                selectedIds={userGroupIds}
                onChange={setUserGroupIds}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to make this event visible to all users.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startAt">{t("startDateTime")}</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="endAt">{t("endDateTime")}</Label>
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
          {saving ? tc("loading") : tc("save")}
        </Button>
      </section>

      {/* Video / Stream */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Video / Stream</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="videoType">{t("videoType")}</Label>
            <Select
              id="videoType"
              value={videoType}
              onChange={(e) => setVideoType(e.target.value)}
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="external">External Link</option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="videoUrl">{t("videoUrl")}</Label>
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
            <span className="text-sm">{t("streamChat")}</span>
          </label>
        </div>
        <Button size="sm" disabled={saving} className="mt-4" onClick={handleSave}>
          Save Video
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold">{tc("publish")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {published
            ? "This event is visible to users."
            : "This event is a draft and not visible to users."}
        </p>
        <Button
          onClick={handlePublish}
          disabled={saving}
          variant={published ? "outline" : "default"}
        >
          {published ? t("unpublishEvent") : t("publishEvent")}
        </Button>
      </section>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Link href="/admin/events" className="text-sm text-(--tenant-primary) hover:underline">
        ← Back to events
      </Link>
    </div>
  );
}
