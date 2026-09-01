"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Calendar, Users, Video } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { createEvent, deleteEvent } from "@/lib/content-actions";

type EventItem = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  startAt: string;
  endAt?: string | null;
  published: boolean;
  registrationCount: number;
};

export function EventsList({ events }: { events: EventItem[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStartAt, setNewStartAt] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newStartAt) return;
    setCreating(true);
    try {
      const event = await createEvent({ title: newTitle, startAt: newStartAt });
      setNewTitle("");
      setNewStartAt("");
      setShowCreate(false);
      window.location.href = `/admin/events/${event.id}`;
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteEvent(id);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => setShowCreate(!showCreate)} className="w-fit" size="sm">
        <Plus className="mr-1 h-4 w-4" />
        Create New Event
      </Button>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="newTitle">Event Title</Label>
            <Input
              id="newTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Monthly Community Call"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="newStartAt">Start Date & Time</Label>
            <Input
              id="newStartAt"
              type="datetime-local"
              value={newStartAt}
              onChange={(e) => setNewStartAt(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={creating} size="sm">
            {creating ? "Creating..." : "Create"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No events yet. Create one to schedule a live event.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const eventDate = new Date(e.startAt);
            const isPast = eventDate < new Date();

            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
              >
                <div className="relative h-32 bg-[var(--muted)]">
                  {e.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.thumbnailUrl}
                      alt={e.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Video className="h-8 w-8 text-[var(--muted-foreground)]" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2">
                    {e.published ? (
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
                  {isPast && (
                    <div className="absolute left-2 top-2">
                      <span className="rounded-full bg-gray-500/90 px-2 py-0.5 text-xs text-white">
                        Past
                      </span>
                    </div>
                  )}
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
                  <h3 className="font-semibold line-clamp-1">{e.title}</h3>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {eventDate.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {e.registrationCount}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="flex-1 rounded-lg bg-[var(--tenant-primary)]/15 px-3 py-1.5 text-center text-sm font-medium text-[var(--tenant-primary)] transition hover:bg-[var(--tenant-primary)]/25"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
