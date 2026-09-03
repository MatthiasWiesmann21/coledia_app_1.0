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
  Reply,
  Play,
  Lock,
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
  authorAvatarUrl: string | null;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  replies: Comment[];
};

type Actions = {
  toggleLike: (id: string) => Promise<any>;
  toggleFavourite: (id: string) => Promise<any>;
  markComplete: (id: string) => Promise<any>;
  addComment: (id: string, content: string) => Promise<any>;
  addReply: (chapterId: string, parentId: string, content: string) => Promise<any>;
  toggleCommentLike: (commentId: string, chapterId: string) => Promise<any>;
  getComments: (chapterId: string) => Promise<Comment[]>;
};

function Avatar({
  name,
  avatarUrl,
  size = "h-8 w-8 text-sm",
}: {
  name: string;
  avatarUrl: string | null;
  size?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  const [box, text] = size.split(" ");
  return (
    <div
      className={`${box} shrink-0 items-center justify-center rounded-full bg-(--tenant-primary) ${text} font-medium text-white flex`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CommentItem({
  comment,
  chapterId,
  actions,
  depth,
}: {
  comment: Comment;
  chapterId: string;
  actions: Actions;
  depth: number;
}) {
  const [liked, setLiked] = useState(comment.liked);
  const [likes, setLikes] = useState(comment.likeCount);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replies, setReplies] = useState<Comment[]>(comment.replies);

  async function handleCommentLike() {
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
    try {
      await actions.toggleCommentLike(comment.id, chapterId);
    } catch {
      setLiked(liked);
      setLikes(likes);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      await actions.addReply(chapterId, comment.id, replyText);
      setReplies([
        ...replies,
        {
          id: Date.now().toString(),
          content: replyText,
          authorName: "You",
          authorUsername: null,
          authorAvatarUrl: null,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          liked: false,
          replies: [],
        },
      ]);
      setReplyText("");
      setShowReplyForm(false);
    } catch (e) {
      console.error(e);
    }
    setPosting(false);
  }

  return (
    <li className="flex gap-3">
      <Avatar name={comment.authorName} avatarUrl={comment.authorAvatarUrl} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.authorName}</span>
          {comment.authorUsername && (
            <span className="text-xs text-muted-foreground">
              @{comment.authorUsername}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {comment.content}
        </p>

        {/* Comment actions: like + reply */}
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={handleCommentLike}
            className={`flex items-center gap-1 text-xs transition ${
              liked
                ? "text-red-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
            {likes > 0 && likes}
          </button>
          {depth < 2 && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <form onSubmit={handleReply} className="mt-3 flex gap-2">
            <Input
              placeholder={`Reply to ${comment.authorName}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={posting || !replyText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Nested replies */}
        {replies.length > 0 && (
          <ul className="mt-3 flex flex-col gap-4 border-l border-border pl-4">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                chapterId={chapterId}
                actions={actions}
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function ChapterView({
  course,
  chapter,
  completed,
  liked,
  favourited,
  likeCount,
  comments,
  completedChapterIds,
  progressPct,
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
  completedChapterIds: string[];
  progressPct: number;
  prevChapterId: string | null;
  nextChapterId: string | null;
  actions: Actions;
}) {
  const [isCompleted, setIsCompleted] = useState(completed);
  const [isLiked, setIsLiked] = useState(liked);
  const [isFav, setIsFav] = useState(favourited);
  const [likes, setLikes] = useState(likeCount);
  const [commentText, setCommentText] = useState("");
  const [commentList, setCommentList] = useState<Comment[]>(comments);
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
    const prevState = isCompleted;
    setIsCompleted(!isCompleted);
    try {
      await actions.markComplete(chapter.id);
    } catch {
      setIsCompleted(prevState);
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
          authorAvatarUrl: null,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          liked: false,
          replies: [],
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
        className="mb-4 inline-block text-sm text-(--tenant-primary) hover:underline"
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
              <div className="flex h-72 items-center justify-center text-muted-foreground">
                No video available
              </div>
            )}
          </div>

          {/* Chapter info + actions */}
          <div className="mt-4">
            <h1 className="text-xl font-bold">{chapter.title}</h1>
            {chapter.author && (
              <p className="mt-1 text-sm text-muted-foreground">
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
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                {likes}
              </button>

              <button
                onClick={handleFavourite}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  isFav
                    ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                Favourite
              </button>

              <button
                onClick={handleComplete}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  isCompleted
                    ? "bg-green-500/15 text-green-500"
                    : "border border-border text-muted-foreground hover:bg-muted"
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
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-2 text-lg font-semibold">About this chapter</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {chapter.description}
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
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
              <p className="py-4 text-center text-sm text-muted-foreground">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {commentList.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    chapterId={chapter.id}
                    actions={actions}
                    depth={0}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {prevChapterId ? (
              <Link
                href={`/courses/${course.id}/chapters/${prevChapterId}`}
                className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-muted"
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
                className="flex items-center gap-1 rounded-lg bg-(--tenant-primary) px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">
                Course complete!
              </span>
            )}
          </div>
        </div>

        {/* Chapter sidebar — progress timeline */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Course Content</h3>

            {/* Progress percentage */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold text-(--tenant-primary)">
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-(--tenant-primary) transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Vertical timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

              <ul className="flex flex-col gap-1">
                {course.chapters.map((ch, i) => {
                  const isCurrent = ch.id === chapter.id;
                  const isCompleted = completedChapterIds.includes(ch.id);
                  return (
                    <li key={ch.id} className="relative">
                      <Link
                        href={`/courses/${course.id}/chapters/${ch.id}`}
                        className={`flex items-center gap-3 rounded-lg py-1.5 pl-0 pr-2 text-sm transition ${
                          isCurrent
                            ? "text-(--tenant-primary)"
                            : isCompleted
                              ? "text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {/* Timeline dot */}
                        <span
                          className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            isCompleted
                              ? "border-green-500 bg-green-500 text-white"
                              : isCurrent
                                ? "border-(--tenant-primary) bg-(--tenant-primary) text-white"
                                : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-xs">{i + 1}</span>
                          )}
                        </span>
                        <span className="line-clamp-1">{ch.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
