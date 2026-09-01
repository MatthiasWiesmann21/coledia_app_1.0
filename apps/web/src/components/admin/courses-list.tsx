"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Layers, Users } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { createCourse, deleteCourse } from "@/lib/course-actions";

type Course = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  level?: string | null;
  specialStatus?: string | null;
  price: number | null;
  published: boolean;
  chapterCount: number;
  enrollmentCount: number;
};

export function CoursesList({ courses }: { courses: Course[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const course = await createCourse({ title: newTitle });
      setNewTitle("");
      setShowCreate(false);
      window.location.href = `/admin/courses/${course.id}`;
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this course and all its chapters?")) return;
    try {
      await deleteCourse(id);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={() => setShowCreate(!showCreate)}
        className="w-fit"
        size="sm"
      >
        <Plus className="mr-1 h-4 w-4" />
        Create New Course
      </Button>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="newTitle">Course Title</Label>
            <Input
              id="newTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Introduction to Web Development"
              required
            />
          </div>
          <Button type="submit" disabled={creating} size="sm">
            {creating ? "Creating..." : "Create"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(false)}
          >
            Cancel
          </Button>
        </form>
      )}

      {courses.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No courses yet. Create one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div
              key={c.id}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
            >
              {/* Thumbnail */}
              <div className="relative h-36 bg-[var(--muted)]">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Layers className="h-8 w-8 text-[var(--muted-foreground)]" />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute right-2 top-2">
                  {c.published ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-xs text-white">
                      <CheckCircle2 className="h-3 w-3" />
                      Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-[var(--muted)]/90 px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      <Circle className="h-3 w-3" />
                      Draft
                    </span>
                  )}
                </div>
                {/* Special status badge */}
                {c.specialStatus && (
                  <div className="absolute left-2 top-2">
                    <span className="rounded-full bg-[var(--tenant-primary)] px-2 py-0.5 text-xs capitalize text-white">
                      {c.specialStatus}
                    </span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                <h3 className="font-semibold line-clamp-1">{c.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.categoryName && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: `${c.categoryColor ?? "#008080"}20`,
                        color: c.categoryColor ?? "#008080",
                      }}
                    >
                      {c.categoryName}
                    </span>
                  )}
                  {c.level && (
                    <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs capitalize text-[var(--muted-foreground)]">
                      {c.level}
                    </span>
                  )}
                  <span className="text-xs font-medium">
                    {c.price ? `$${c.price}` : "Free"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {c.chapterCount} chapters
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {c.enrollmentCount} enrolled
                  </span>
                </div>
                <div className="mt-3 flex gap-1">
                  <Link
                    href={`/admin/courses/${c.id}`}
                    className="flex-1 rounded-lg bg-[var(--tenant-primary)]/15 px-3 py-1.5 text-center text-sm font-medium text-[var(--tenant-primary)] transition hover:bg-[var(--tenant-primary)]/25"
                  >
                    Edit
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(c.id)}
                    className="text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
