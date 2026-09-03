"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

type UserGroup = { id: string; name: string };

export function UserGroupMultiSelect({
  userGroups,
  selectedIds,
  onChange,
}: {
  userGroups: UserGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedGroups = useMemo(
    () => userGroups.filter((g) => selectedIds.includes(g.id)),
    [userGroups, selectedIds],
  );

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return userGroups;
    const q = search.toLowerCase();
    return userGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [userGroups, search]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  if (userGroups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No user groups available. Create groups in Admin → Usergroups.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        <div className="flex flex-wrap items-center gap-1">
          {selectedGroups.length === 0 ? (
            <span className="text-muted-foreground">All users</span>
          ) : (
            selectedGroups.slice(0, 3).map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 rounded-md bg-(--tenant-primary)/15 px-2 py-0.5 text-xs text-(--tenant-primary)"
              >
                {g.name}
                <X
                  className="h-3 w-3 cursor-pointer hover:opacity-70"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(g.id);
                  }}
                />
              </span>
            ))
          )}
          {selectedGroups.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{selectedGroups.length - 3} more
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          {/* Search input */}
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md bg-background px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search groups..."
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {search && (
                <X
                  className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:opacity-70"
                  onClick={() => setSearch("")}
                />
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto p-1">
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No groups found
              </p>
            ) : (
              filteredGroups.map((g) => {
                const selected = selectedIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-(--tenant-primary) bg-(--tenant-primary)" : "border-border"}`}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {g.name}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {selectedIds.length > 0 && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Clear all ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
