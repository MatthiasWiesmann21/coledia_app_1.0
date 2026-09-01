"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import {
  createUserGroup,
  deleteUserGroup,
} from "@/lib/course-actions";

type Group = {
  id: string;
  name: string;
  memberCount: number;
};

export function UserGroupsList({ groups }: { groups: Group[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createUserGroup(newName);
      setNewName("");
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this usergroup?")) return;
    try {
      await deleteUserGroup(id);
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
        New Usergroup
      </Button>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="newName">Usergroup Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Premium Members"
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

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No usergroups yet. Create one to organize your members.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                    <Users className="h-3.5 w-3.5" />
                    {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/admin/usergroups/${g.id}`}
                    className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
