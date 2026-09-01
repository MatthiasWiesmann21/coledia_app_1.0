"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import {
  updateUserGroup,
  addUserToGroup,
  removeUserFromGroup,
} from "@/lib/course-actions";

type Member = {
  userId: string;
  name: string;
  username: string | null;
};

type GroupData = {
  id: string;
  name: string;
  members: Member[];
};

export function UserGroupEditor({
  group,
  availableMembers,
}: {
  group: GroupData;
  availableMembers: Member[];
}) {
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const memberIds = new Set(group.members.map((m) => m.userId));
  const nonMembers = availableMembers.filter((m) => !memberIds.has(m.userId));

  async function handleSaveName() {
    setSaving(true);
    setMsg(null);
    try {
      await updateUserGroup(group.id, name);
      setMsg("Name saved");
    } catch {
      setMsg("Could not save name");
    }
    setSaving(false);
  }

  async function handleAdd() {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await addUserToGroup(group.id, selectedUserId);
      setSelectedUserId("");
      setMsg("Member added");
    } catch {
      setMsg("Could not add member");
    }
    setSaving(false);
  }

  async function handleRemove(userId: string) {
    try {
      await removeUserFromGroup(group.id, userId);
      setMsg("Member removed");
    } catch {
      setMsg("Could not remove member");
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Name */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Usergroup Name</h2>
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={saving} onClick={handleSaveName}>
            Save
          </Button>
        </div>
      </section>

      {/* Members */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Members ({group.members.length})</h2>

        {/* Add member */}
        {nonMembers.length > 0 && (
          <div className="mb-4 flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="addMember">Add Member</Label>
              <select
                id="addMember"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                <option value="">Select a member...</option>
                {nonMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                    {m.username ? ` (@${m.username})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" disabled={saving || !selectedUserId} onClick={handleAdd}>
              <UserPlus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        )}

        {/* Member list */}
        {group.members.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
            No members in this group yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="text-sm">
                  {m.name}
                  {m.username ? (
                    <span className="ml-1 text-[var(--muted-foreground)]">
                      @{m.username}
                    </span>
                  ) : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(m.userId)}
                  className="text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {msg && (
        <p className="text-sm text-[var(--muted-foreground)]">{msg}</p>
      )}

      <Link
        href="/admin/usergroups"
        className="text-sm text-[var(--tenant-primary)] hover:underline"
      >
        ← Back to usergroups
      </Link>
    </div>
  );
}
