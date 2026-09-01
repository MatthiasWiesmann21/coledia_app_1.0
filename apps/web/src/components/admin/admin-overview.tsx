import Link from "next/link";
import {
  BookOpen,
  Newspaper,
  CalendarDays,
  Users,
  GraduationCap,
  BarChart3,
  Tag,
  FolderTree,
  Settings,
  ArrowRight,
  Plus,
} from "lucide-react";

type Stats = {
  totalUsers: number;
  totalCourses: number;
  totalPosts: number;
  totalEvents: number;
  publishedCourses: number;
  publishedPosts: number;
  publishedEvents: number;
  totalEnrollments: number;
};

type RecentItem = {
  id: string;
  title: string;
  published: boolean;
  createdAt: string;
};

type RecentEvent = {
  id: string;
  title: string;
  published: boolean;
  startAt: string;
};

export function AdminOverview({
  stats,
  recentCourses,
  recentPosts,
  recentEvents,
}: {
  stats: Stats;
  recentCourses: RecentItem[];
  recentPosts: RecentItem[];
  recentEvents: RecentEvent[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Users"
          value={stats.totalUsers}
          href="/admin/users"
          color="#1f78b4"
        />
        <StatCard
          icon={BookOpen}
          label="Courses"
          value={stats.totalCourses}
          sublabel={`${stats.publishedCourses} published`}
          href="/admin/courses"
          color="#008080"
        />
        <StatCard
          icon={Newspaper}
          label="Posts"
          value={stats.totalPosts}
          sublabel={`${stats.publishedPosts} published`}
          href="/admin/posts"
          color="#e6550d"
        />
        <StatCard
          icon={CalendarDays}
          label="Events"
          value={stats.totalEvents}
          sublabel={`${stats.publishedEvents} published`}
          href="/admin/events"
          color="#756bb1"
        />
      </div>

      {/* Enrollments banner */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/15">
            <GraduationCap className="h-6 w-6 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-3xl font-bold">{stats.totalEnrollments}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Total Course Enrollments
            </p>
          </div>
          <Link
            href="/admin/analytics"
            className="flex items-center gap-1 text-sm text-[var(--tenant-primary)] hover:underline"
          >
            View analytics <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          icon={Plus}
          label="New Course"
          href="/admin/courses"
          color="#008080"
        />
        <QuickAction
          icon={Plus}
          label="New Post"
          href="/admin/posts"
          color="#e6550d"
        />
        <QuickAction
          icon={Plus}
          label="New Event"
          href="/admin/events"
          color="#756bb1"
        />
        <QuickAction
          icon={Tag}
          label="New Category"
          href="/admin/categories"
          color="#1f78b4"
        />
      </div>

      {/* Recent items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentList
          title="Recent Courses"
          items={recentCourses.map((c) => ({
            id: c.id,
            title: c.title,
            published: c.published,
            subtitle: new Date(c.createdAt).toLocaleDateString(),
            href: `/admin/courses/${c.id}`,
          }))}
          viewAllHref="/admin/courses"
        />
        <RecentList
          title="Recent Posts"
          items={recentPosts.map((p) => ({
            id: p.id,
            title: p.title,
            published: p.published,
            subtitle: new Date(p.createdAt).toLocaleDateString(),
            href: `/admin/posts/${p.id}`,
          }))}
          viewAllHref="/admin/posts"
        />
        <RecentList
          title="Recent Events"
          items={recentEvents.map((e) => ({
            id: e.id,
            title: e.title,
            published: e.published,
            subtitle: new Date(e.startAt).toLocaleDateString(),
            href: `/admin/events/${e.id}`,
          }))}
          viewAllHref="/admin/events"
        />
      </div>

      {/* Other admin sections */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <AdminLink
          icon={FolderTree}
          label="Usergroups"
          href="/admin/usergroups"
        />
        <AdminLink icon={Tag} label="Categories" href="/admin/categories" />
        <AdminLink icon={Users} label="Users" href="/admin/users" />
        <AdminLink
          icon={BarChart3}
          label="Analytics"
          href="/admin/analytics"
        />
        <AdminLink
          icon={Settings}
          label="Settings"
          href="/admin/settings"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  sublabel?: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--tenant-primary)]/50 hover:shadow-md"
    >
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
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--tenant-primary)]/50 hover:shadow-md"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <span className="font-medium">{label}</span>
      <ArrowRight className="ml-auto h-4 w-4 text-[var(--muted-foreground)]" />
    </Link>
  );
}

function RecentList({
  title,
  items,
  viewAllHref,
}: {
  title: string;
  items: {
    id: string;
    title: string;
    published: boolean;
    subtitle: string;
    href: string;
  }[];
  viewAllHref: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={viewAllHref}
          className="text-xs text-[var(--tenant-primary)] hover:underline"
        >
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
          Nothing yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[var(--muted)]"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    item.published ? "bg-green-500" : "bg-[var(--muted-foreground)]"
                  }`}
                />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.subtitle}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminLink({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--tenant-primary)]/50 hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-[var(--muted-foreground)]" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
