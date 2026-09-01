"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Bookmark,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Send,
} from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";

type Chapter = {
  id: string;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  author?: string | null;
  duration?: string | null;
};

type CourseData = {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
};

type Comment = {
  id: string;
  content: string;
  authorName: string;
  authorUsername: string | null;
  createdAt: string;
};

export function ChapterView({
  course,
  chapter,
  completed,
  liked,
  favourited,
  likeCount,
  comments,
  prevChapterId,
  nextChapterId,
  actions,
}: {
  course: CourseData;
  chapter: Chapter;
  completed: boolean;
  liked: boolean;
  favourited: boolean;
  likeCount: number;
  comments: Comment[];
  prevChapterId: string | null;
  nextChapterId: string | null;
  actions: {
    toggleLike: (id: string) => Promise<any>;
    toggleFavourite: (id: string) => Promise<any>;
    markComplete: (id: string) => Promise<any>;
    addComment: (id: string, content: string) => Promise<any>;
  };
}) {
  const [isCompleted, setIsCompleted] = useState(completed);
  const [isLiked, setIsLiked] = useState(liked);
  const [isFav, setIsFav] = useState(favourited);
  const [likes, setLikes] = useState(likeCount);
  const [commentText, setCommentText] = useState("");
  const [commentList, setCommentList] = useState(comments);
  const [posting, setPosting] = useState(false);

  async function handleLike() {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
    try {
      await actions.toggleLike(chapter.id);
    } catch {
      setIsLiked(isLiked);
      setLikes(likes);
    }
  }

  async function handleFavourite() {
    setIsFav(!isFav);
    try {
      await actions.toggleFavourite(chapter.id);
    } catch {
      setIsFav(isFav);
    }
  }

  async function handleComplete() {
    if (isCompleted) return;
    setIsCompleted(true);
    try {
      await actions.markComplete(chapter.id);
    } catch {
      setIsCompleted(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await actions.addComment(chapter.id, commentText);
      setCommentList([
        {
          id: Date.now().toString(),
          content: commentText,
          authorName: "You",
          authorUsername: null,
          createdAt: new Date().toISOString(),
        },
        ...commentList,
      ]);
      setCommentText("");
    } catch (e) {
      console.error(e);
    }
    setPosting(false);
  }

  // Convert YouTube/Vimeo URLs to embed URLs
  function getEmbedUrl(url: string, type: string): string {
    if (type === "youtube") {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      return match ? `https://www.youtube.com/embed/${match[1]}` : url;
    }
    if (type === "vimeo") {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : url;
    }
    return url;
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href={`/courses/${course.id}`}
        className="mb-4 inline-block text-sm text-[var(--tenant-primary)] hover:underline"
      >
        ← {course.title}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Main content */}
        <div className="lg:col-span-3">
          {/* Video player */}
          <div className="overflow-hidden rounded-xl bg-black">
            {chapter.videoUrl ? (
              chapter.videoType === "external" ? (
                <a
                  href={chapter.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-72 items-center justify-center text-white hover:underline"
                >
                  Open video in new tab →
                </a>
              ) : (
                <iframe
                  src={getEmbedUrl(chapter.videoUrl, chapter.videoType ?? "youtube")}
                  className="h-72 w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <div className="flex h-72 items-center justify-center text-[var(--muted-foreground)]">
                No video available
              </div>
            )}
          </div>

          {/* Chapter info + actions */}
          <div className="mt-4">
            <h1 className="text-xl font-bold">{chapter.title}</h1>
            {chapter.author && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                by {chapter.author}
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  isLiked
                    ? "bg-red-500/15 text-red-500"
                    : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                {likes}
              </button>

              <button
                onClick={handleFavourite}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  isFav
                    ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                    : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                Favourite
              </button>

              <button
                onClick={handleComplete}
                disabled={isCompleted}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  isCompleted
                    ? "bg-green-500/15 text-green-500"
                    : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {isCompleted ? "Completed" : "Mark Complete"}
              </button>
            </div>
          </div>

          {/* Description */}
          {chapter.description && (
            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="mb-2 text-lg font-semibold">About this chapter</h2>
              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
                {chapter.description}
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="mb-4 text-lg font-semibold">
              Comments ({commentList.length})
            </h2>

            {/* Comment form */}
            <form onSubmit={handleComment} className="mb-6 flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={posting || !commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {/* Comment list */}
            {commentList.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {commentList.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-sm font-medium text-white">
                      {c.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.authorName}</span>
                        {c.authorUsername && (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            @{c.authorUsername}
                          </span>
                        )}
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {c.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {prevChapterId ? (
              <Link
                href={`/courses/${course.id}/chapters/${prevChapterId}`}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-[var(--muted)]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span />
            )}
            {nextChapterId ? (
              <Link
                href={`/courses/${course.id}/chapters/${nextChapterId}`}
                className="flex items-center gap-1 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="text-sm text-[var(--muted-foreground)]">
                Course complete!
              </span>
            )}
          </div>
        </div>

        {/* Chapter sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 text-sm font-semibold">Course Content</h3>
            <ul className="flex flex-col gap-1">
              {course.chapters.map((ch, i) => (
                <li key={ch.id}>
                  <Link
                    href={`/courses/${course.id}/chapters/${ch.id}`}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                      ch.id === chapter.id
                        ? "bg-[var(--tenant-primary)]/15 text-[var(--tenant-primary)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    <span className="text-xs">{i + 1}.</span>
                    <span className="line-clamp-1">{ch.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
