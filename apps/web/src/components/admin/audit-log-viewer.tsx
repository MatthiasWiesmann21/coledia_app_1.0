"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

type LogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  userName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export function AuditLogViewer({
  logs,
  actions,
  entityTypes,
  page,
  pageSize,
  total,
  filters,
}: {
  logs: LogRow[];
  actions: string[];
  entityTypes: string[];
  page: number;
  pageSize: number;
  total: number;
  filters: { action?: string; entityType?: string; q?: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`/admin/audit-logs?${params.toString()}`);
  }

  const actionColors: Record<string, string> = useMemo(
    () => ({
      create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      update: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      delete: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
      role_change: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      settings_change: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      invite: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    }),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search..."
          defaultValue={filters.q ?? ""}
          onChange={(e) => update("q", e.target.value)}
          className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          value={filters.action ?? ""}
          onChange={(e) => update("action", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filters.entityType ?? ""}
          onChange={(e) => update("entityType", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {total} entr{total === 1 ? "y" : "ies"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No audit log entries match your filters.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${actionColors[log.action] ?? "bg-muted text-muted-foreground"}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{log.entityType}</span>
                  {log.entityId && (
                    <span className="ml-1 text-xs text-muted-foreground">#{log.entityId.slice(-6)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {log.userName ?? <span className="text-muted-foreground">system</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {log.metadata ? JSON.stringify(log.metadata).slice(0, 120) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => update("page", String(page - 1))}
            className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => update("page", String(page + 1))}
            className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
