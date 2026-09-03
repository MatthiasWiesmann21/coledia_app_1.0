"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  FileText,
  Newspaper,
  CalendarDays,
  MessageSquare,
  Hash,
  User,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";

type SearchResult = {
  type:
    | "course"
    | "chapter"
    | "post"
    | "event"
    | "document"
    | "chatroom"
    | "channel"
    | "dm";
  id: string;
  title: string;
  href: string;
  subtitle?: string;
};

const TYPE_META: Record<
  SearchResult["type"],
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  course: { icon: BookOpen, label: "Course" },
  chapter: { icon: BookOpen, label: "Chapter" },
  post: { icon: Newspaper, label: "News" },
  event: { icon: CalendarDays, label: "Event" },
  document: { icon: FileText, label: "Document" },
  chatroom: { icon: MessageSquare, label: "Chatroom" },
  channel: { icon: Hash, label: "Channel" },
  dm: { icon: User, label: "Direct Message" },
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open with Cmd/Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setActiveIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Keyboard navigation in results
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        setOpen(false);
        router.push(selected.href);
      }
    }
  }

  function handleSelect(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden shrink-0 rounded border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={containerRef}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses, news, events, chat, documents..."
                className="flex-1 bg-transparent text-base outline-none placeholder:text-[var(--muted-foreground)]"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  ...
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Close search"
              >
                <kbd className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium">
                  ESC
                </kbd>
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  Start typing to search across the platform
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {results.map((result, index) => {
                    const meta = TYPE_META[result.type];
                    const Icon = meta.icon;
                    const isActive = index === activeIndex;
                    return (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                            isActive
                              ? "bg-[var(--tenant-primary)]/15"
                              : "hover:bg-[var(--muted)]",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive
                                ? "text-[var(--tenant-primary)]"
                                : "text-[var(--muted-foreground)]",
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">
                              {result.title}
                            </span>
                            {result.subtitle && (
                              <span className="truncate text-xs text-[var(--muted-foreground)]">
                                {result.subtitle}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[var(--muted-foreground)]">
                            {meta.label}
                          </span>
                          {isActive && (
                            <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
