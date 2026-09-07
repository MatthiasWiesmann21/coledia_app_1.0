"use client";

import { useState } from "react";
import { Trash2, Shield, User, UserCog, Wrench } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { updateUserRole, removeUser } from "@/lib/admin-actions";
import { useConfirm } from "@/components/confirm-provider";

type User = {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  role: string;
  joinedAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  online: "#31a354",
  not_available: "#e6550d",
  do_not_disturb: "#dc2626",
  invisible: "#6b7280",
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Shield,
  admin: UserCog,
  operator: Wrench,
  member: User,
};

const ROLE_COLORS: Record<string, string> = {
  owner: "text-purple-500 bg-purple-500/15",
  admin: "text-blue-500 bg-blue-500/15",
  operator: "text-orange-500 bg-orange-500/15",
  member: "text-[var(--muted-foreground)] bg-[var(--muted)]",
};

export function UsersList({ users }: { users: User[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function handleRoleChange(userId: string, role: string) {
    setLoading(userId);
    setError(null);
    try {
      await updateUserRole(userId, role);
    } catch (e: any) {
      setError(e.message ?? "Could not update role");
    }
    setLoading(null);
  }

  async function handleRemove(userId: string) {
    const ok = await confirm({
      title: "Remove this user?",
      description: "This user will lose access to the tenant.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    setLoading(userId);
    setError(null);
    try {
      await removeUser(userId);
    } catch (e: any) {
      setError(e.message ?? "Could not remove user");
    }
    setLoading(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      )}

      {users.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No users in this tenant yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const RoleIcon = ROLE_ICONS[u.role] ?? User;
                return (
                  <tr
                    key={u.userId}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.avatarUrl}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-sm font-medium text-white">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--card)]"
                            style={{
                              backgroundColor: STATUS_COLORS[u.status] ?? "#31a354",
                            }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          {u.username && (
                            <p className="text-xs text-[var(--muted-foreground)]">
                              @{u.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLORS[u.status] ?? "#31a354",
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            ROLE_COLORS[u.role] ?? ROLE_COLORS.member
                          }`}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {u.role}
                        </span>
                        {u.role !== "owner" && (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                            disabled={loading === u.userId}
                            className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
                          >
                            <option value="member">member</option>
                            <option value="operator">operator</option>
                            <option value="admin">admin</option>
                            <option value="owner">owner</option>
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      {new Date(u.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {u.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(u.userId)}
                            disabled={loading === u.userId}
                            className="text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
