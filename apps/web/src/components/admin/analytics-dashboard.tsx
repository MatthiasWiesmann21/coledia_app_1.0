"use client";

import {
  Users,
  BookOpen,
  Newspaper,
  CalendarDays,
  GraduationCap,
  TrendingUp,
  Heart,
  Bookmark,
  MessageSquare,
} from "lucide-react";
import { useTranslations } from "next-intl";

type Stats = {
  totalUsers: number;
  totalCourses: number;
  totalPosts: number;
  totalEvents: number;
  totalEnrollments: number;
  publishedCourses: number;
  publishedPosts: number;
  publishedEvents: number;
  totalLikes: number;
  totalFavourites: number;
  totalComments: number;
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
  const t = useTranslations("adminStats");
  return (
    <div className="flex flex-col gap-6">
      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("totalUsers")}
          value={stats.totalUsers}
          color="#1f78b4"
        />
        <StatCard
          icon={BookOpen}
          label={t("totalCourses")}
          value={stats.totalCourses}
          sublabel={t("publishedCount", { count: stats.publishedCourses })}
          color="#008080"
        />
        <StatCard
          icon={Newspaper}
          label={t("totalPosts")}
          value={stats.totalPosts}
          sublabel={t("publishedCount", { count: stats.publishedPosts })}
          color="#e6550d"
        />
        <StatCard
          icon={CalendarDays}
          label={t("totalEvents")}
          value={stats.totalEvents}
          sublabel={t("publishedCount", { count: stats.publishedEvents })}
          color="#756bb1"
        />
      </div>

      {/* Engagement stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label={t("totalEnrollments")}
          value={stats.totalEnrollments}
          color="#31a354"
        />
        <StatCard
          icon={Heart}
          label={t("likes")}
          value={stats.totalLikes}
          color="#dc2626"
        />
        <StatCard
          icon={Bookmark}
          label={t("saves")}
          value={stats.totalFavourites}
          color="#756bb1"
        />
        <StatCard
          icon={MessageSquare}
          label={t("comments")}
          value={stats.totalComments}
          color="#e6550d"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" />
            {t("categoryDistribution")}
          </h2>
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noCategories")}
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
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {t("coursesCount", { count: cat.courses })}
                        </span>
                      )}
                      {cat.posts > 0 && (
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {t("postsCount", { count: cat.posts })}
                        </span>
                      )}
                      {cat.events > 0 && (
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {t("eventsCount", { count: cat.events })}
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
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t("coursesByEnrollment")}</h2>
          {courseStats.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noCourses")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {courseStats
                .sort((a, b) => b.enrollments - a.enrollments)
                .slice(0, 5)
                .map((c, i) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm font-bold text-muted-foreground">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("chaptersCount", { count: c.chapters })} · {c.published ? t("publishedLabel") : t("draftLabel")}
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
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("recentEnrollments")}</h2>
        {recentEnrollments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("noEnrollments")}
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">{t("user")}</th>
                <th className="pb-2 font-medium">{t("course")}</th>
                <th className="pb-2 font-medium">{t("progress")}</th>
                <th className="pb-2 font-medium">{t("date")}</th>
              </tr>
            </thead>
            <tbody>
              {recentEnrollments.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="py-3 text-sm font-medium">{e.userName}</td>
                  <td className="py-3 text-sm text-muted-foreground">
                    {e.courseTitle}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full progress-brand"
                          style={{ width: `${e.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {e.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">
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
    <div className="rounded-xl border border-border bg-card p-5">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
