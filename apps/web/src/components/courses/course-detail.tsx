"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Clock, BarChart, Play, CheckCircle2, Lock, Star } from "lucide-react";
import { Button } from "@coledia/ui/button";

type Chapter = {
  id: string;
  title: string;
  duration?: string | null;
  level?: string | null;
  author?: string | null;
  accessFree: boolean;
  videoType?: string | null;
};

type CourseData = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  level?: string | null;
  specialStatus?: string | null;
  price: number | null;
  duration?: string | null;
  chapters: Chapter[];
};

export function CourseDetail({
  course,
  enrolled,
  progressPct,
  completedChapterIds,
  isLoggedIn,
  enrollAction,
}: {
  course: CourseData;
  enrolled: boolean;
  progressPct: number;
  completedChapterIds: string[];
  isLoggedIn: boolean;
  enrollAction: (courseId: string) => Promise<any>;
}) {
  const [enrolling, setEnrolling] = useState(false);

  async function handleEnroll() {
    if (!isLoggedIn) {
      window.location.href = "/sign-in";
      return;
    }
    setEnrolling(true);
    try {
      await enrollAction(course.id);
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
    setEnrolling(false);
  }

  const canAccess = enrolled || course.price === null || course.price === 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/courses"
        className="mb-4 inline-block text-sm text-[var(--tenant-primary)] hover:underline"
      >
        ← All courses
      </Link>

      {/* Header */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Thumbnail */}
        <div className="lg:col-span-2">
          <div className="relative h-64 overflow-hidden rounded-xl bg-[var(--muted)]">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Layers className="h-16 w-16 text-[var(--muted-foreground)]" />
              </div>
            )}
          </div>
        </div>

        {/* Info sidebar */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h1 className="text-xl font-bold">{course.title}</h1>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {course.categoryName && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: `${course.categoryColor ?? "#008080"}20`,
                  color: course.categoryColor ?? "#008080",
                }}
              >
                {course.categoryName}
              </span>
            )}
            {course.level && (
              <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs capitalize">
                {course.level}
              </span>
            )}
            {course.specialStatus && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--tenant-primary)] px-2 py-0.5 text-xs capitalize text-white">
                <Star className="h-3 w-3" />
                {course.specialStatus}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-col gap-2 text-sm text-[var(--muted-foreground)]">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {course.chapters.length} chapters
            </span>
            {course.duration && (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {course.duration}
              </span>
            )}
            {course.level && (
              <span className="flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                <span className="capitalize">{course.level}</span>
              </span>
            )}
          </div>

          {/* Price + Enroll */}
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="text-2xl font-bold">
              {course.price ? `$${course.price}` : "Free"}
            </p>

            {enrolled ? (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">Progress</span>
                  <span className="font-medium">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full progress-brand"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {course.chapters.length > 0 && (
                  <Link
                    href={`/courses/${course.id}/chapters/${course.chapters[0].id}`}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    <Play className="h-4 w-4" />
                    {progressPct > 0 ? "Continue Learning" : "Start Course"}
                  </Link>
                )}
              </div>
            ) : (
              <Button
                onClick={handleEnroll}
                disabled={enrolling}
                className="mt-3 w-full"
              >
                {enrolling
                  ? "Enrolling..."
                  : course.price
                    ? `Enroll for $${course.price}`
                    : "Enroll for Free"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {course.description && (
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-3 text-lg font-semibold">About this course</h2>
          <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
            {course.description}
          </p>
        </div>
      )}

      {/* Chapters list */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Course Content ({course.chapters.length} chapters)
        </h2>

        {course.chapters.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
            No chapters available yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {course.chapters.map((ch, i) => {
              const completed = completedChapterIds.includes(ch.id);
              const locked = !canAccess && !ch.accessFree;

              return (
                <li key={ch.id}>
                  {locked ? (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 opacity-60">
                      <Lock className="h-4 w-4 text-[var(--muted-foreground)]" />
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {i + 1}. {ch.title}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/courses/${course.id}/chapters/${ch.id}`}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 transition hover:bg-[var(--muted)]"
                    >
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {i + 1}.
                      </span>
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Play className="h-4 w-4 text-[var(--tenant-primary)]" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ch.title}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          {ch.duration && <span>{ch.duration}</span>}
                          {ch.author && <span>· {ch.author}</span>}
                          {ch.accessFree && (
                            <span className="rounded bg-green-500/15 px-1 text-green-500">
                              Free
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
