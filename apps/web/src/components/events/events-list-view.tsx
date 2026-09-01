"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Users, Video, Clock } from "lucide-react";
import { Input } from "@coledia/ui/input";

type EventItem = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  startAt: string;
  endAt?: string | null;
  registrationCount: number;
};

type Category = { id: string; name: string; color: string };

export function EventsList({
  upcomingEvents,
  pastEvents,
  categories,
}: {
  upcomingEvents: EventItem[];
  pastEvents: EventItem[];
  categories: Category[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  function filterEvents(events: EventItem[]) {
    return events.filter((e) => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (selectedCategory) {
        const cat = categories.find((c) => c.id === selectedCategory);
        if (e.categoryName !== cat?.name) return false;
      }
      return true;
    });
  }

  const filteredUpcoming = filterEvents(upcomingEvents);
  const filteredPast = filterEvents(pastEvents);
  const displayed = showPast ? filteredPast : filteredUpcoming;

  return (
    <div className="flex flex-col gap-6">
      {/* Search + filters */}
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search events..."
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
              style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Upcoming / Past toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowPast(false)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              !showPast
                ? "bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            Upcoming ({filteredUpcoming.length})
          </button>
          <button
            onClick={() => setShowPast(true)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              showPast
                ? "bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            Past ({filteredPast.length})
          </button>
        </div>
      </div>

      {/* Events grid */}
      {displayed.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
          {showPast ? "No past events found." : "No upcoming events. Check back soon!"}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((e) => {
            const eventDate = new Date(e.startAt);
            return (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition hover:border-[var(--tenant-primary)]/50 hover:shadow-lg"
              >
                <div className="relative h-40 bg-[var(--muted)]">
                  {e.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.thumbnailUrl}
                      alt={e.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Video className="h-10 w-10 text-[var(--muted-foreground)]" />
                    </div>
                  )}
                  {/* Date badge */}
                  <div className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-center text-white">
                    <p className="text-xs font-bold leading-none">
                      {eventDate.toLocaleDateString("en", { month: "short" }).toUpperCase()}
                    </p>
                    <p className="text-lg font-bold leading-none">
                      {eventDate.getDate()}
                    </p>
                  </div>
                </div>

                <div className="p-4">
                  {e.categoryName && (
                    <span
                      className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: `${e.categoryColor ?? "#008080"}20`,
                        color: e.categoryColor ?? "#008080",
                      }}
                    >
                      {e.categoryName}
                    </span>
                  )}
                  <h3 className="font-semibold line-clamp-2 group-hover:text-[var(--tenant-primary)]">
                    {e.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {eventDate.toLocaleTimeString("en", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {e.registrationCount} registered
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
