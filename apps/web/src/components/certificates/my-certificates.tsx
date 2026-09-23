"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@coledia/ui/input";
import { Select } from "@coledia/ui/select";
import { Award, Download, Search } from "lucide-react";

export type CertificateItem = {
  id: string;
  issuedAt: string;
  certificateUrl: string | null;
  courseTitle: string;
  categoryName: string | null;
  categoryColor: string | null;
};

type SortKey = "newest" | "oldest" | "title";

export function MyCertificates({
  items,
  locale,
}: {
  items: CertificateItem[];
  locale: string;
}) {
  const t = useTranslations("certificates");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      if (i.categoryName) map.set(i.categoryName, i.categoryName);
    }
    return [...map.keys()].sort();
  }, [items]);

  const visible = useMemo(() => {
    let list = items;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => i.courseTitle.toLowerCase().includes(q));
    if (category !== "all") list = list.filter((i) => i.categoryName === category);
    return [...list].sort((a, b) => {
      if (sort === "newest") return b.issuedAt.localeCompare(a.issuedAt);
      if (sort === "oldest") return a.issuedAt.localeCompare(b.issuedAt);
      return a.courseTitle.localeCompare(b.courseTitle);
    });
  }, [items, search, category, sort]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-64 pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={setCategory}
          wrapperClassName="w-auto"
          className="w-auto"
          options={[
            { value: "all", label: t("allCategories") },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as SortKey)}
          wrapperClassName="w-auto"
          className="w-auto"
          options={[
            { value: "newest", label: t("sortNewest") },
            { value: "oldest", label: t("sortOldest") },
            { value: "title", label: t("sortTitle") },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {items.length === 0 ? t("noCertificates") : t("noResults")}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((cert) => (
            <li
              key={cert.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-(--tenant-primary)/15">
                <Award className="h-6 w-6 text-(--tenant-primary)" />
              </div>
              <p className="font-semibold">{cert.courseTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("issuedOn", {
                  date: new Date(cert.issuedAt).toLocaleDateString(locale),
                })}
              </p>
              {cert.categoryName && (
                <span
                  className="mt-2 inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: cert.categoryColor ?? "#6b7280" }}
                >
                  {cert.categoryName}
                </span>
              )}
              {cert.certificateUrl && (
                <a
                  href={`${cert.certificateUrl}?download=1`}
                  className="mt-4 inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  {t("downloadPdf")}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
