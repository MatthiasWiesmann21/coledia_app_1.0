"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updateCategory } from "@/lib/course-actions";

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

export function CategoryEditor({ category }: { category: CategoryData }) {
  const router = useRouter();
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

  async function handleSave(section: string, data: Partial<CategoryData>) {
    setSaving(true);
    setMsg(null);
    try {
      await updateCategory(category.id, data);
      setMsg(`${section} saved`);
    } catch (e) {
      setMsg(`Could not save ${section.toLowerCase()}`);
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await updateCategory(category.id, { published: !published });
      setPublished(!published);
      setMsg(!published ? "Category published" : "Category unpublished");
    } catch (e) {
      setMsg("Could not toggle publish");
    }
    setSaving(false);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Name */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Category Name</h2>
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => handleSave("Name", { name })}
          >
            Save
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
            <span className="text-sm">Course Category</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isNews}
              onChange={(e) => setIsNews(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">News Category</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isEvent}
              onChange={(e) => setIsEvent(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Live Event Category</span>
          </label>
        </div>
        <Button
          size="sm"
          disabled={saving}
          className="mt-4"
          onClick={() => handleSave("Type", { isCourse, isNews, isEvent })}
        >
          Save Type
        </Button>
      </section>

      {/* Colors */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Customization</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="color">Category Color</Label>
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
          onClick={() =>
            handleSave("Colors", { color, textColorLight, textColorDark })
          }
        >
          Save Colors
        </Button>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Publish</h2>
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
          {published ? "Unpublish" : "Publish Category"}
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
