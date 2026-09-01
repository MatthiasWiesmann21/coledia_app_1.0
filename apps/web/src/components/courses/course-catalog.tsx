"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Layers, Star } from "lucide-react";
import { Input } from "@coledia/ui/input";

type Course = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  level?: string | null;
  specialStatus?: string | null;
  price: number | null;
  chapterCount: number;
};

type Category = { id: string; name: string; color: string };

export function CourseCatalog({
  courses,
  categories,
}: {
  courses: Course[];
  categories: Category[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const filtered = courses.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (selectedCategory && c.categoryName !== categories.find((cat) => cat.id === selectedCategory)?.name) {
      return false;
    }
    if (selectedStatus && c.specialStatus !== selectedStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search + filters */}
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              !selectedCategory
                ? "bg-[var(--tenant-primary)] text-white"
                : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                selectedCategory === cat.id
                  ? "text-white"
                  : "border border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
              style={
                selectedCategory === cat.id
                  ? { backgroundColor: cat.color }
                  : undefined
              }
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedStatus(null)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              !selectedStatus
                ? "bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            All statuses
          </button>
          {["featured", "trending", "exclusive"].map((status) => (
            <button
              key={status}
              onClick={() =>
                setSelectedStatus(selectedStatus === status ? null : status)
              }
              className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                selectedStatus === status
                  ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Course grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
          No courses found. Try adjusting your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition hover:border-[var(--tenant-primary)]/50 hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div className="relative h-40 bg-[var(--muted)]">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Layers className="h-10 w-10 text-[var(--muted-foreground)]" />
                  </div>
                )}
                {/* Special status badge */}
                {c.specialStatus && (
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[var(--tenant-primary)] px-2 py-0.5 text-xs capitalize text-white">
                    <Star className="h-3 w-3" />
                    {c.specialStatus}
                  </div>
                )}
                {/* Price badge */}
                <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  {c.price ? `$${c.price}` : "Free"}
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                {c.categoryName && (
                  <span
                    className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: `${c.categoryColor ?? "#008080"}20`,
                      color: c.categoryColor ?? "#008080",
                    }}
                  >
                    {c.categoryName}
                  </span>
                )}
                <h3 className="font-semibold line-clamp-2 group-hover:text-[var(--tenant-primary)]">
                  {c.title}
                </h3>
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {c.level && (
                    <span className="capitalize">{c.level}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {c.chapterCount} chapters
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
