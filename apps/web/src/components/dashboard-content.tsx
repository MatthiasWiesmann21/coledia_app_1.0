"use client";

import Link from "next/link";
import {
  BookOpen,
  CheckCircle,
  Layers,
  Users,
  Calendar,
  MessageSquare,
  Heart,
  Clock,
} from "lucide-react";

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

type FavouriteCourse = {
  id: string;
  title: string;
  category: string;
  categoryColor: string;
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
  favouriteCourses = [],
}: {
  stats: Stats;
  myCourses: MyCourse[];
  upcomingEvents?: UpcomingEvent[];
  recentActivity?: RecentActivity[];
  favouriteCourses?: FavouriteCourse[];
}) {
  const notStarted = myCourses.length - stats.inProgress - stats.completed;
  const donutData = [
    { label: "Not Started", value: Math.max(0, notStarted), color: "#1f78b4" },
    { label: "In Progress", value: stats.inProgress, color: "#e6550d" },
    { label: "Complete", value: stats.completed, color: "#31a354" },
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
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="In Progress"
          value={stats.inProgress}
          color="#e6550d"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed Courses"
          value={stats.completed}
          color="#31a354"
        />
        <StatCard
          icon={Layers}
          label="Completed Chapters"
          value={stats.completedChapters}
          color="#1f78b4"
        />
        <StatCard
          icon={Users}
          label="Members Online"
          value={stats.onlineMembers}
          color="#008080"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming Events */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming Events</h2>
            <Link
              href="/events"
              className="text-sm text-(--tenant-primary) hover:underline"
            >
              View All
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No upcoming events. Check the events page for more.
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
          <h2 className="mb-4 text-lg font-semibold">Course Progress</h2>
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
                className="fill-[var(--foreground)] text-xl font-bold"
              >
                {total}
              </text>
              <text
                x="60"
                y="78"
                textAnchor="middle"
                className="fill-[var(--muted-foreground)] text-[10px]"
              >
                Courses
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
            <h2 className="text-lg font-semibold">My Courses</h2>
            <Link
              href="/courses"
              className="text-sm text-(--tenant-primary) hover:underline"
            >
              View All
            </Link>
          </div>
          {myCourses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                You haven&apos;t enrolled in any courses yet.
              </p>
              <Link
                href="/courses"
                className="text-sm font-medium text-(--tenant-primary) hover:underline"
              >
                Browse courses →
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Course Name</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Payment</th>
                  <th className="pb-2 font-medium">Progress</th>
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
                        className="hover:text-(--tenant-primary)"
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
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recent activity. Start commenting on courses or news to see
              your activity here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
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
                      Commented on
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

      {/* Favourite Courses */}
      {favouriteCourses.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Heart className="h-5 w-5 text-red-500" />
              Favourite Courses
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favouriteCourses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 transition hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{course.title}</p>
                  <span
                    className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${course.categoryColor}20`,
                      color: course.categoryColor,
                    }}
                  >
                    {course.category}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
