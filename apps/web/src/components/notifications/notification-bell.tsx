"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, Check, CheckCheck } from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";
import { getSocket } from "@/lib/socket";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notification-actions";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function timeAgo(iso: string, locale: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  return new Date(iso).toLocaleDateString(locale);
}

export function NotificationBell({
  userId,
  tenantId,
  locale,
}: {
  userId: string;
  tenantId: string;
  locale: string;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [list, count] = await Promise.all([
      getMyNotifications(10),
      getUnreadNotificationCount(),
    ]);
    setItems(list);
    setUnread(count);
  }, []);

  // Initial fetch + realtime updates + focus refetch fallback
  useEffect(() => {
    refresh();

    const socket = getSocket(userId, tenantId);
    const onNew = () => refresh();
    socket.on("notification:new", onNew);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      socket.off("notification:new", onNew);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, tenantId, refresh]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen(item: NotificationItem) {
    if (!item.read) {
      await markNotificationRead(item.id);
      setUnread((c) => Math.max(0, c - 1));
      setItems((list) =>
        list.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label={t("title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t("title")}</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleOpen(item)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left text-sm transition hover:bg-muted last:border-b-0",
                    !item.read && "bg-(--tenant-primary)/5",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {!item.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-(--tenant-primary)" />
                    )}
                    <span className={cn("flex-1 truncate", !item.read && "font-semibold")}>
                      {item.title}
                    </span>
                    {item.read && <Check className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  </span>
                  {item.body && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.body}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(item.createdAt, locale)}
                  </span>
                </button>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-(--tenant-primary) transition hover:bg-muted"
          >
            {t("viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
