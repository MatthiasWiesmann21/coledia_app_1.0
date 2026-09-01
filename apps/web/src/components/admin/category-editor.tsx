"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updateCategory } from "@/lib/course-actions";
import { saveTranslation } from "@/lib/translation-actions";
import { LanguageToggle } from "@/components/admin/language-toggle";
import { defaultLocale, type Locale } from "@/i18n/config";

type CategoryData = {
  id: string;
  name: string;
  isCourse: boolean;
  isNews: boolean;
  isEvent: boolean;
  color: string;
  textColorLight: string;
  textColorDark: string;
  published: boolean;
};

type Translations = Record<string, Record<string, string>>;

export function CategoryEditor({
  category,
  translations: initialTranslations,
}: {
  category: CategoryData;
  translations: Translations;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const router = useRouter();
  const [activeLanguage, setActiveLanguage] = useState<Locale>(defaultLocale);
  const [allTranslations, setAllTranslations] = useState<Translations>(initialTranslations);
  const [translationEdits, setTranslationEdits] = useState<Record<string, Record<string, string>>>({});

  const [name, setName] = useState(category.name);
  const [isCourse, setIsCourse] = useState(category.isCourse);
  const [isNews, setIsNews] = useState(category.isNews);
  const [isEvent, setIsEvent] = useState(category.isEvent);
  const [color, setColor] = useState(category.color);
  const [textColorLight, setTextColorLight] = useState(category.textColorLight);
  const [textColorDark, setTextColorDark] = useState(category.textColorDark);
  const [published, setPublished] = useState(category.published);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function handleLanguageChange(lang: Locale) {
    if (activeLanguage !== defaultLocale) {
      setTranslationEdits((prev) => ({
        ...prev,
        [activeLanguage]: { ...prev[activeLanguage], name },
      }));
    }
    setActiveLanguage(lang);
    if (lang === defaultLocale) {
      setName(category.name);
    } else {
      const cached = translationEdits[lang];
      const stored = allTranslations[lang];
      setName(cached?.name ?? stored?.name ?? "");
    }
  }

  const translatedLanguages = new Set<string>();
  for (const lang of Object.keys(allTranslations)) {
    if (allTranslations[lang]?.name) translatedLanguages.add(lang);
  }

  async function handleSaveName() {
    setSaving(true);
    setMsg(null);
    try {
      if (activeLanguage === defaultLocale) {
        await updateCategory(category.id, { name });
      } else {
        await saveTranslation({
          entityType: "category",
          entityId: category.id,
          field: "name",
          language: activeLanguage,
          value: name,
        });
        setAllTranslations((prev) => ({
          ...prev,
          [activeLanguage]: { ...prev[activeLanguage], name },
        }));
      }
      setMsg("Name saved");
    } catch {
      setMsg("Could not save name");
    }
    setSaving(false);
  }

  async function handleSaveType() {
    setSaving(true);
    setMsg(null);
    try {
      await updateCategory(category.id, { isCourse, isNews, isEvent });
      setMsg("Type saved");
    } catch {
      setMsg("Could not save type");
    }
    setSaving(false);
  }

  async function handleSaveColors() {
    setSaving(true);
    setMsg(null);
    try {
      await updateCategory(category.id, { color, textColorLight, textColorDark });
      setMsg("Colors saved");
    } catch {
      setMsg("Could not save colors");
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await updateCategory(category.id, { published: !published });
      setPublished(!published);
      setMsg(!published ? "Category published" : "Category unpublished");
    } catch {
      setMsg("Could not toggle publish");
    }
    setSaving(false);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Name */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("editCategory")}</h2>

        <LanguageToggle
          activeLanguage={activeLanguage}
          onLanguageChange={handleLanguageChange}
          translatedLanguages={translatedLanguages}
          className="mb-4 border-b border-[var(--border)] pb-4"
        />

        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="name">{tc("name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={saving}
            onClick={handleSaveName}
          >
            {saving ? tc("loading") : tc("save")}
          </Button>
        </div>
      </section>

      {/* Type toggles */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Category Type</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Select which modules this category applies to. A category can be used
          across multiple modules.
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isCourse}
              onChange={(e) => setIsCourse(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("course")} Category</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isNews}
              onChange={(e) => setIsNews(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("news")} Category</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isEvent}
              onChange={(e) => setIsEvent(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("event")} Category</span>
          </label>
        </div>
        <Button
          size="sm"
          disabled={saving}
          className="mt-4"
          onClick={handleSaveType}
        >
          Save Type
        </Button>
      </section>

      {/* Colors */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Customization</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="color">{tc("color")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 rounded border border-[var(--border)]"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="textColorLight">Text Color (Light Mode)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={textColorLight}
                onChange={(e) => setTextColorLight(e.target.value)}
                className="h-10 w-12 rounded border border-[var(--border)]"
              />
              <Input
                value={textColorLight}
                onChange={(e) => setTextColorLight(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="textColorDark">Text Color (Dark Mode)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={textColorDark}
                onChange={(e) => setTextColorDark(e.target.value)}
                className="h-10 w-12 rounded border border-[var(--border)]"
              />
              <Input
                value={textColorDark}
                onChange={(e) => setTextColorDark(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
        <Button
          size="sm"
          disabled={saving}
          className="mt-4"
          onClick={handleSaveColors}
        >
          Save Colors
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">{tc("publish")}</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {published
            ? "This category is visible to users."
            : "This category is a draft and not visible to users."}
        </p>
        <Button
          onClick={handlePublish}
          disabled={saving}
          variant={published ? "outline" : "default"}
        >
          {published ? tc("unpublish") : "Publish Category"}
        </Button>
      </section>

      {msg && (
        <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>
      )}

      <Link
        href="/admin/categories"
        className="text-sm text-[var(--tenant-primary)] hover:underline"
      >
        ← Back to categories
      </Link>
    </div>
  );
}
