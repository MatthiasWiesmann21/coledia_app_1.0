"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  CheckCircle,
  Layers,
  Users,
  MessageSquare,
  Clock,
  Bookmark,
  Newspaper,
  CalendarDays,
  X,
} from "lucide-react";
import { removeFavourite } from "@/lib/content-actions";

type Stats = {
  inProgress: number;
  completed: number;
  completedChapters: number;
  onlineMembers: number;
};

type UpcomingEvent = {
  id: string;
  title: string;
  startAt: string;
  category: string;
  categoryColor: string;
};

type RecentActivity = {
  id: string;
  type: "comment";
  content: string;
  createdAt: string;
  targetTitle: string;
  targetHref: string;
};

type FavouriteItem = {
  id: string;
  targetType: string;
  targetId: string;
  title: string;
  href: string;
};

type OnlineMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  lastActive: string;
};

type MyCourse = {
  id: string;
  title: string;
  category: string;
  categoryColor: string;
  progress: number;
  paymentStatus: string;
};

export function DashboardContent({
  stats,
  myCourses,
  upcomingEvents = [],
  recentActivity = [],
  favouriteItems = [],
  onlineMembers = [],
}: {
  stats: Stats;
  myCourses: MyCourse[];
  upcomingEvents?: UpcomingEvent[];
  recentActivity?: RecentActivity[];
  favouriteItems?: FavouriteItem[];
  onlineMembers?: OnlineMember[];
}) {
  const t = useTranslations("dashboard");
  const notStarted = myCourses.length - stats.inProgress - stats.completed;
  const donutData = [
    { label: t("statNotStarted"), value: Math.max(0, notStarted), color: "#1f78b4" },
    { label: t("statInProgress"), value: stats.inProgress, color: "#e6550d" },
    { label: t("statComplete"), value: stats.completed, color: "#31a354" },
  ];
  const total = donutData.reduce((sum, d) => sum + d.value, 0) || 1;

  // SVG donut chart calculation
  const circumference = 2 * Math.PI * 40;
  let offset = 0;
  const segments = donutData.map((d) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const seg = { ...d, dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label={t("inProgress")}
          value={stats.inProgress}
          color="#e6550d"
        />
        <StatCard
          icon={CheckCircle}
          label={t("completedCourses")}
          value={stats.completed}
          color="#31a354"
        />
        <StatCard
          icon={Layers}
          label={t("completedChapters")}
          value={stats.completedChapters}
          color="#1f78b4"
        />
        <StatCard
          icon={Users}
          label={t("signedInMembers")}
          value={stats.onlineMembers}
          color="#008080"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming Events */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("upcomingEvents")}</h2>
            <Link
              href="/events"
              className="text-sm text-primary hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noUpcomingEvents")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingEvents.map((event) => {
                const date = new Date(event.startAt);
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 rounded-lg border border-border p-3 transition hover:bg-muted"
                  >
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
                      <span className="text-xs font-medium text-muted-foreground">
                        {date.toLocaleString("default", { month: "short" })}
                      </span>
                      <span className="text-lg font-bold">
                        {date.getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {event.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${event.categoryColor}20`,
                            color: event.categoryColor,
                          }}
                        >
                          {event.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {date.toLocaleTimeString("default", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t("courseProgress")}</h2>
          <div className="flex flex-col items-center gap-4">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="40"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="12"
              />
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx="60"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="12"
                  strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                  strokeDashoffset={-seg.offset}
                  transform="rotate(-90 60 60)"
                />
              ))}
              <text
                x="60"
                y="60"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground text-xl font-bold"
              >
                {total}
              </text>
              <text
                x="60"
                y="78"
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {t("courses")}
              </text>
            </svg>
            <div className="flex w-full flex-col gap-2">
              {donutData.map((d) => (
                <div
                  key={d.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.label}
                  </span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* My Courses */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("myCourses")}</h2>
            <Link
              href="/courses"
              className="text-sm text-primary hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
          {myCourses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                {t("noEnrolled")}
              </p>
              <Link
                href="/courses"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("browseCourses")} →
              </Link>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">{t("courseName")}</th>
                    <th className="pb-2 font-medium">{t("category")}</th>
                    <th className="pb-2 font-medium">{t("payment")}</th>
                    <th className="pb-2 font-medium">{t("progress")}</th>
                  </tr>
                </thead>
                <tbody>
                  {myCourses.map((course) => (
                    <tr
                      key={course.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 text-sm font-medium">
                        <Link
                          href={`/courses/${course.id}`}
                          className="hover:text-primary"
                        >
                          {course.title}
                        </Link>
                      </td>
                      <td className="py-3 text-sm">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${course.categoryColor}20`,
                            color: course.categoryColor,
                          }}
                        >
                          {course.category}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {course.paymentStatus}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full progress-brand"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {course.progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t("recentActivity")}</h2>
          {recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noActivity")}
            </p>
          ) : (
            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
              {recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  href={activity.targetHref}
                  className="flex gap-3 rounded-lg p-2 transition hover:bg-muted"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {t("commentedOn")}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {activity.targetTitle}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {activity.content}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Favourites (grouped by type) */}
      <FavouritesSection items={favouriteItems} />

      {/* Signed-in Members */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-primary" />
            {t("signedInMembers")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {t("xActive", { count: onlineMembers.length })}
          </span>
        </div>
        {onlineMembers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noMembersOnline")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {onlineMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="relative shrink-0">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("activeAgo", { time: timeAgo(member.lastActive, t) })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const FAVOURITE_GROUPS: {
  type: string;
  labelKey: "courses" | "chapters" | "news" | "events";
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "course", labelKey: "courses", icon: BookOpen },
  { type: "chapter", labelKey: "chapters", icon: Layers },
  { type: "post", labelKey: "news", icon: Newspaper },
  { type: "event", labelKey: "events", icon: CalendarDays },
];

function FavouritesSection({ items }: { items: FavouriteItem[] }) {
  const t = useTranslations("dashboard");
  const [list, setList] = useState(items);
  const [pending, startTransition] = useTransition();

  function handleRemove(item: FavouriteItem) {
    setList((prev) => prev.filter((f) => f.id !== item.id));
    startTransition(async () => {
      try {
        await removeFavourite(item.targetType, item.targetId);
      } catch {
        setList((prev) =>
          [...prev, item].sort(
            (a, b) => items.findIndex((i) => i.id === a.id) - items.findIndex((i) => i.id === b.id),
          ),
        );
      }
    });
  }

  if (list.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Bookmark className="h-5 w-5 text-primary" />
        {t("favourites")}
      </h2>
      <div className="flex flex-col gap-5">
        {FAVOURITE_GROUPS.map((group) => {
          const groupItems = list.filter((f) => f.targetType === group.type);
          if (groupItems.length === 0) return null;
          const GroupIcon = group.icon;
          return (
            <div key={group.type}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <GroupIcon className="h-4 w-4" />
                {t(group.labelKey)}
              </h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groupItems.map((item) => (
                  <li
                    key={item.id}
                    className="group flex items-center gap-2 rounded-lg border border-border px-3 py-2 transition hover:bg-muted"
                  >
                    <Link href={item.href} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.title}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      disabled={pending}
                      aria-label={t("removeFavourite")}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-red-500 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(isoDate: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(isoDate);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { count: days });
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
