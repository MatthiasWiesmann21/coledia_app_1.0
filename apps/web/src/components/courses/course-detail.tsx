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
  const completedCount = completedChapterIds.length;
  const totalChapters = course.chapters.length;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/courses"
        className="mb-4 inline-block text-sm text-(--tenant-primary) hover:underline"
      >
        ← All courses
      </Link>

      {/* Header */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Thumbnail */}
        <div className="lg:col-span-2">
          <div className="relative h-64 overflow-hidden rounded-xl bg-muted">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Layers className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Info sidebar */}
        <div className="rounded-xl border border-border bg-card p-6">
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
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                {course.level}
              </span>
            )}
            {course.specialStatus && (
              <span className="flex items-center gap-1 rounded-full bg-(--tenant-primary) px-2 py-0.5 text-xs capitalize text-white">
                <Star className="h-3 w-3" />
                {course.specialStatus}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
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
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-2xl font-bold">
              {course.price ? `$${course.price}` : "Free"}
            </p>

            {enrolled ? (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full progress-brand"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {course.chapters.length > 0 && (
                  <Link
                    href={`/courses/${course.id}/chapters/${course.chapters[0].id}`}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-(--tenant-primary) px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
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
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">About this course</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {course.description}
          </p>
        </div>
      )}

      {/* Chapters list — vertical timeline */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Course Content ({totalChapters} chapters)
          </h2>
          {enrolled && totalChapters > 0 && (
            <span className="text-sm font-medium text-(--tenant-primary)">
              {completedCount}/{totalChapters} completed
            </span>
          )}
        </div>

        {/* Overall progress bar */}
        {enrolled && totalChapters > 0 && (
          <div className="mb-6">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall progress</span>
              <span className="font-semibold">{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-(--tenant-primary) transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {totalChapters === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No chapters available yet.
          </p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-border" />

            <ul className="flex flex-col gap-2">
              {course.chapters.map((ch, i) => {
                const isCompleted = completedChapterIds.includes(ch.id);
                const locked = !canAccess && !ch.accessFree;

                return (
                  <li key={ch.id} className="relative">
                    {locked ? (
                      <div className="flex items-center gap-3 py-2 pl-0 pr-2 opacity-60">
                        <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {i + 1}. {ch.title}
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={`/courses/${course.id}/chapters/${ch.id}`}
                        className="flex items-center gap-3 rounded-lg py-2 pl-0 pr-2 transition hover:bg-muted"
                      >
                        {/* Timeline dot */}
                        <span
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            isCompleted
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Play className="h-3 w-4 pl-0.5 text-(--tenant-primary)" />
                          )}
                        </span>

                        {/* Chapter info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {i + 1}.
                            </span>
                            <p className={`text-sm ${isCompleted ? "font-medium" : ""}`}>
                              {ch.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {ch.duration && <span>{ch.duration}</span>}
                            {ch.author && <span>· {ch.author}</span>}
                            {ch.accessFree && (
                              <span className="rounded bg-green-500/15 px-1 text-green-500">
                                Free
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-green-500">✓ Done</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
