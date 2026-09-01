"use client";

import Link from "next/link";
import { BookOpen, CheckCircle, Layers, Users, Eye } from "lucide-react";

type Stats = {
  inProgress: number;
  completed: number;
  completedChapters: number;
  onlineMembers: number;
};

type PopularChapter = {
  id: string;
  name: string;
  course: string;
  category: string;
  likes: number;
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
  popularChapters,
  myCourses,
}: {
  stats: Stats;
  popularChapters: PopularChapter[];
  myCourses: MyCourse[];
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
          label="Completed"
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
          label="Current Online Users"
          value={stats.onlineMembers}
          color="#008080"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Most Popular Chapters */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Most Popular Chapters</h2>
            <button className="text-sm text-[var(--tenant-primary)] hover:underline">
              My Favourite Chapters
            </button>
          </div>
          {popularChapters.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              No chapters available yet.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="pb-2 font-medium">Chapter Name</th>
                  <th className="pb-2 font-medium">Course</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Likes</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {popularChapters.map((ch) => (
                  <tr
                    key={ch.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-3 text-sm font-medium">{ch.name}</td>
                    <td className="py-3 text-sm text-[var(--muted-foreground)]">
                      {ch.course}
                    </td>
                    <td className="py-3 text-sm text-[var(--muted-foreground)]">
                      {ch.category}
                    </td>
                    <td className="py-3 text-right text-sm">{ch.likes}</td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/courses/${ch.id}`}
                        className="inline-flex rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Donut chart */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
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
            <div className="flex flex-col gap-2 w-full">
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

      {/* My Courses */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Courses</h2>
          <div className="flex gap-3">
            <button className="text-sm text-[var(--tenant-primary)] hover:underline">
              My Favourite Courses
            </button>
            <Link
              href="/courses"
              className="text-sm text-[var(--tenant-primary)] hover:underline"
            >
              View All
            </Link>
          </div>
        </div>
        {myCourses.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-[var(--muted-foreground)]">
              You haven&apos;t enrolled in any courses yet.
            </p>
            <Link
              href="/courses"
              className="text-sm font-medium text-[var(--tenant-primary)] hover:underline"
            >
              Browse courses →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
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
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="py-3 text-sm font-medium">
                    <Link
                      href={`/courses/${course.id}`}
                      className="hover:text-[var(--tenant-primary)]"
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
                  <td className="py-3 text-sm text-[var(--muted-foreground)]">
                    {course.paymentStatus}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
                        <div
                          className="h-full progress-brand"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
