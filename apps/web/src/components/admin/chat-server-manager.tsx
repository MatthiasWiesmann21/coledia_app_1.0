"use client";

import { useState } from "react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Hash,
  Pencil,
} from "lucide-react";
import {
  createChatServer,
  deleteChatServer,
  updateChatServer,
  createChannel,
  updateChannel,
  deleteChannel,
} from "@/lib/chat-actions";
import { UserGroupMultiSelect } from "@/components/admin/usergroup-multiselect";

type ChannelData = {
  id: string;
  name: string;
  userGroupIds: string[];
  userGroupNames: string[];
};

type ServerData = {
  id: string;
  name: string;
  userGroupIds: string[];
  userGroupNames: string[];
  channelCount: number;
  memberCount: number;
  channels: ChannelData[];
};

type UserGroup = { id: string; name: string };

export function ChatServerManager({
  servers: initialServers,
  userGroups,
}: {
  servers: ServerData[];
  userGroups: UserGroup[];
}) {
  const [servers, setServers] = useState(initialServers);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUserGroupIds, setNewUserGroupIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUserGroupIds, setEditUserGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Expanded server panels (show channels)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Channel creation state per server
  const [showChannelCreate, setShowChannelCreate] = useState<string | null>(
    null,
  );
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelGroupIds, setNewChannelGroupIds] = useState<string[]>([]);
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Channel editing state
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelGroupIds, setEditChannelGroupIds] = useState<string[]>([]);
  const [savingChannel, setSavingChannel] = useState(false);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createChatServer(newName, newUserGroupIds);
      setNewName("");
      setNewUserGroupIds([]);
      setShowCreate(false);
      setServers([
        {
          id: Date.now().toString(),
          name: newName,
          userGroupIds: newUserGroupIds,
          userGroupNames: userGroups
            .filter((g) => newUserGroupIds.includes(g.id))
            .map((g) => g.name),
          channelCount: 0,
          memberCount: 1,
          channels: [],
        },
        ...servers,
      ]);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this chat server and all its channels?")) return;
    try {
      await deleteChatServer(id);
      setServers(servers.filter((s) => s.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  function startEdit(s: ServerData) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditUserGroupIds(s.userGroupIds);
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      await updateChatServer(id, {
        name: editName,
        userGroupIds: editUserGroupIds,
      });
      setServers(
        servers.map((s) =>
          s.id === id
            ? {
                ...s,
                name: editName,
                userGroupIds: editUserGroupIds,
                userGroupNames: userGroups
                  .filter((g) => editUserGroupIds.includes(g.id))
                  .map((g) => g.name),
              }
            : s,
        ),
      );
      setEditingId(null);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  // ─── Channel handlers ───────────────────────────────────────

  async function handleCreateChannel(serverId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
    try {
      await createChannel(serverId, newChannelName, newChannelGroupIds);
      const newChannel: ChannelData = {
        id: Date.now().toString(),
        name: newChannelName,
        userGroupIds: newChannelGroupIds,
        userGroupNames: userGroups
          .filter((g) => newChannelGroupIds.includes(g.id))
          .map((g) => g.name),
      };
      setServers(
        servers.map((s) =>
          s.id === serverId
            ? {
                ...s,
                channels: [...s.channels, newChannel],
                channelCount: s.channelCount + 1,
              }
            : s,
        ),
      );
      setNewChannelName("");
      setNewChannelGroupIds([]);
      setShowChannelCreate(null);
    } catch (e) {
      console.error(e);
    }
    setCreatingChannel(false);
  }

  async function handleDeleteChannel(serverId: string, channelId: string) {
    if (!confirm("Delete this channel and all its messages?")) return;
    try {
      await deleteChannel(channelId);
      setServers(
        servers.map((s) =>
          s.id === serverId
            ? {
                ...s,
                channels: s.channels.filter((c) => c.id !== channelId),
                channelCount: s.channelCount - 1,
              }
            : s,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  }

  function startEditChannel(c: ChannelData) {
    setEditingChannelId(c.id);
    setEditChannelName(c.name);
    setEditChannelGroupIds(c.userGroupIds);
  }

  async function handleSaveChannel(serverId: string, channelId: string) {
    setSavingChannel(true);
    try {
      await updateChannel(channelId, {
        name: editChannelName,
        userGroupIds: editChannelGroupIds,
      });
      setServers(
        servers.map((s) =>
          s.id === serverId
            ? {
                ...s,
                channels: s.channels.map((c) =>
                  c.id === channelId
                    ? {
                        ...c,
                        name: editChannelName,
                        userGroupIds: editChannelGroupIds,
                        userGroupNames: userGroups
                          .filter((g) => editChannelGroupIds.includes(g.id))
                          .map((g) => g.name),
                      }
                    : c,
                ),
              }
            : s,
        ),
      );
      setEditingChannelId(null);
    } catch (e) {
      console.error(e);
    }
    setSavingChannel(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create button */}
      <div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          variant="outline"
          size="sm"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Chat Server
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="newName">Server Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. General Chat"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>User Groups (optional)</Label>
            <UserGroupMultiSelect
              userGroups={userGroups}
              selectedIds={newUserGroupIds}
              onChange={setNewUserGroupIds}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
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
          </div>
        </form>
      )}

      {/* Server list */}
      {servers.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No chat servers yet. Create one to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-card"
            >
              {editingId === s.id ? (
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-2">
                    <Label>Server Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>User Groups</Label>
                    <UserGroupMultiSelect
                      userGroups={userGroups}
                      selectedIds={editUserGroupIds}
                      onChange={setEditUserGroupIds}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => handleSaveEdit(s.id)}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Server header row */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(s.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        {expandedIds.has(s.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div>
                        <h3 className="font-semibold">{s.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{s.channelCount} channels</span>
                          <span>{s.memberCount} members</span>
                          {s.userGroupNames.length > 0 ? (
                            s.userGroupNames.map((name) => (
                              <span
                                key={name}
                                className="rounded-full bg-(--tenant-primary)/15 px-2 py-0.5 text-(--tenant-primary)"
                              >
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5">
                              All users
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(s)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(s.id)}
                        className="text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Channels panel */}
                  {expandedIds.has(s.id) && (
                    <div className="border-t border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Channels
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowChannelCreate(
                              showChannelCreate === s.id ? null : s.id,
                            )
                          }
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          New Channel
                        </Button>
                      </div>

                      {/* New channel form */}
                      {showChannelCreate === s.id && (
                        <form
                          onSubmit={(e) => handleCreateChannel(s.id, e)}
                          className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
                        >
                          <div className="flex flex-col gap-2">
                            <Label>Channel Name</Label>
                            <Input
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value)}
                              placeholder="e.g. announcements"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>User Groups (optional)</Label>
                            <UserGroupMultiSelect
                              userGroups={userGroups}
                              selectedIds={newChannelGroupIds}
                              onChange={setNewChannelGroupIds}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                creatingChannel || !newChannelName.trim()
                              }
                            >
                              {creatingChannel ? "Creating..." : "Create"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowChannelCreate(null);
                                setNewChannelName("");
                                setNewChannelGroupIds([]);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      )}

                      {/* Channel list */}
                      {s.channels.length === 0 ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          No channels yet. Create one to start chatting.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {s.channels.map((c) => (
                            <li
                              key={c.id}
                              className="rounded-lg border border-border bg-background p-3"
                            >
                              {editingChannelId === c.id ? (
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col gap-2">
                                    <Label>Channel Name</Label>
                                    <Input
                                      value={editChannelName}
                                      onChange={(e) =>
                                        setEditChannelName(e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <Label>User Groups</Label>
                                    <UserGroupMultiSelect
                                      userGroups={userGroups}
                                      selectedIds={editChannelGroupIds}
                                      onChange={setEditChannelGroupIds}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      disabled={savingChannel}
                                      onClick={() =>
                                        handleSaveChannel(s.id, c.id)
                                      }
                                    >
                                      {savingChannel ? "Saving..." : "Save"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingChannelId(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Hash className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <span className="text-sm font-medium">
                                        {c.name}
                                      </span>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                        {c.userGroupNames.length > 0 ? (
                                          c.userGroupNames.map((name) => (
                                            <span
                                              key={name}
                                              className="rounded-full bg-(--tenant-primary)/15 px-2 py-0.5 text-(--tenant-primary)"
                                            >
                                              {name}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="rounded-full bg-muted px-2 py-0.5">
                                            All server members
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startEditChannel(c)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleDeleteChannel(s.id, c.id)
                                      }
                                      className="text-red-500 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
