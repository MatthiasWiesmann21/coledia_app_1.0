"use client";

import {
  Users,
  BookOpen,
  Newspaper,
  CalendarDays,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

type Stats = {
  totalUsers: number;
  totalCourses: number;
  totalPosts: number;
  totalEvents: number;
  totalEnrollments: number;
  publishedCourses: number;
  publishedPosts: number;
  publishedEvents: number;
};

type Category = {
  name: string;
  color: string;
  courses: number;
  posts: number;
  events: number;
};

type RecentEnrollment = {
  id: string;
  userName: string;
  courseTitle: string;
  progress: number;
  enrolledAt: string;
};

type CourseStat = {
  id: string;
  title: string;
  enrollments: number;
  chapters: number;
  published: boolean;
};

export function AnalyticsDashboard({
  stats,
  categories,
  recentEnrollments,
  courseStats,
}: {
  stats: Stats;
  categories: Category[];
  recentEnrollments: RecentEnrollment[];
  courseStats: CourseStat[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          color="#1f78b4"
        />
        <StatCard
          icon={BookOpen}
          label="Total Courses"
          value={stats.totalCourses}
          sublabel={`${stats.publishedCourses} published`}
          color="#008080"
        />
        <StatCard
          icon={Newspaper}
          label="Total Posts"
          value={stats.totalPosts}
          sublabel={`${stats.publishedPosts} published`}
          color="#e6550d"
        />
        <StatCard
          icon={CalendarDays}
          label="Total Events"
          value={stats.totalEvents}
          sublabel={`${stats.publishedEvents} published`}
          color="#756bb1"
        />
      </div>

      {/* Enrollment stat */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/15">
            <GraduationCap className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-3xl font-bold">{stats.totalEnrollments}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Total Course Enrollments
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category distribution */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" />
            Category Distribution
          </h2>
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
              No categories yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {categories.map((cat) => {
                const total = cat.courses + cat.posts + cat.events;
                return (
                  <li key={cat.name} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <div className="flex gap-2 text-xs">
                      {cat.courses > 0 && (
                        <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">
                          {cat.courses} courses
                        </span>
                      )}
                      {cat.posts > 0 && (
                        <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">
                          {cat.posts} posts
                        </span>
                      )}
                      {cat.events > 0 && (
                        <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">
                          {cat.events} events
                        </span>
                      )}
                    </div>
                    <span className="w-8 text-right text-sm font-bold">{total}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Top courses by enrollment */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 text-lg font-semibold">Courses by Enrollment</h2>
          {courseStats.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
              No courses yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {courseStats
                .sort((a, b) => b.enrollments - a.enrollments)
                .slice(0, 5)
                .map((c, i) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <span className="text-sm font-bold text-[var(--muted-foreground)]">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">{c.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {c.chapters} chapters · {c.published ? "Published" : "Draft"}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{c.enrollments}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent enrollments */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Enrollments</h2>
        {recentEnrollments.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
            No enrollments yet.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Course</th>
                <th className="pb-2 font-medium">Progress</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentEnrollments.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 text-sm font-medium">{e.userName}</td>
                  <td className="py-3 text-sm text-[var(--muted-foreground)]">
                    {e.courseTitle}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-[var(--muted)]">
                        <div
                          className="h-full progress-brand"
                          style={{ width: `${e.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {e.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-sm text-[var(--muted-foreground)]">
                    {new Date(e.enrolledAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      {sublabel && (
        <p className="text-xs text-[var(--muted-foreground)]">{sublabel}</p>
      )}
    </div>
  );
}
