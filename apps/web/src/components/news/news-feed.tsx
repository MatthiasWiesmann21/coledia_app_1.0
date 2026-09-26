"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Newspaper } from "lucide-react";
import { Input } from "@coledia/ui/input";
import { useTranslations } from "next-intl";

type Post = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  gifUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  createdAt: string;
};

type Category = { id: string; name: string; color: string };

export function NewsFeed({ posts, categories }: { posts: Post[]; categories: Category[] }) {
  const t = useTranslations("posts");
  const tcm = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = posts.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (selectedCategory) {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (p.categoryName !== cat?.name) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search + filters */}
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchNews")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              !selectedCategory
                ? "bg-primary text-white"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {tcm("all")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                selectedCategory === cat.id
                  ? "text-white"
                  : "border border-border hover:bg-muted"
              }`}
              style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("noPostsFound")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/news/${p.id}`}
              className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg"
            >
              {/* Image */}
              {p.imageUrl && (
                <div className="h-48 overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
              )}

              <div className="p-5">
                {p.categoryName && (
                  <span
                    className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: `${p.categoryColor ?? "#008080"}20`,
                      color: p.categoryColor ?? "#008080",
                    }}
                  >
                    {p.categoryName}
                  </span>
                )}
                <h3 className="font-semibold line-clamp-2 group-hover:text-primary">
                  {p.title}
                </h3>
                {p.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {p.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
