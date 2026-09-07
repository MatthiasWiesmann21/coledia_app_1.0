"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notification-actions";

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_COLORS: Record<string, string> = {
  new_post: "#2563eb",
  new_event: "#7c3aed",
  event_reminder: "#7c3aed",
  direct_message: "#0891b2",
  chat_mention: "#0891b2",
  course_update: "#059669",
  document_update: "#d97706",
  member_joined: "#db2777",
  certificate_issued: "#ca8a04",
  purchase_completed: "#16a34a",
};

export function NotificationList({
  initialItems,
  locale,
}: {
  initialItems: NotificationListItem[];
  locale: string;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const visible = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  async function handleOpen(item: NotificationListItem) {
    if (!item.read) {
      await markNotificationRead(item.id);
      setItems((list) =>
        list.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
    }
    if (item.link) router.push(item.link);
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            filter === "all"
              ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {t("filterAll")}
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            filter === "unread"
              ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {t("filterUnread", { count: unreadCount })}
        </button>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CheckCheck className="h-4 w-4" />
            {t("markAllRead")}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleOpen(item)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted",
                  !item.read && "bg-(--tenant-primary)/5",
                )}
              >
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[item.type] ?? "#6b7280" }}
                />
                <span className="flex-1">
                  <span className={cn("block text-sm", !item.read && "font-semibold")}>
                    {item.title}
                  </span>
                  {item.body && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {item.body}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString(locale)}
                  </span>
                </span>
                {item.read && <Check className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
