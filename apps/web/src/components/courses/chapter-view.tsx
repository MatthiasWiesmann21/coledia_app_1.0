"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  Trash2,
  Flag,
} from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { useConfirm } from "@/components/confirm-provider";
import { Celebration } from "@/components/celebration";

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
  canDelete?: boolean;
  replies: Comment[];
};

type Actions = {
  toggleLike: (id: string) => Promise<any>;
  toggleFavourite: (id: string) => Promise<any>;
  markComplete: (id: string) => Promise<any>;
  addComment: (id: string, content: string) => Promise<any>;
  addReply: (chapterId: string, parentId: string, content: string) => Promise<any>;
  toggleCommentLike: (commentId: string, chapterId: string) => Promise<any>;
  getComments: (
    chapterId: string,
    opts?: { skip?: number; take?: number },
  ) => Promise<{ comments: Comment[]; hasMore: boolean; total: number }>;
  deleteComment?: (commentId: string) => Promise<any>;
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
      className={`${box} shrink-0 items-center justify-center rounded-full bg-primary ${text} font-medium text-white flex`}
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
  const [removed, setRemoved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();
  const tc = useTranslations("courses");
  const tp = useTranslations("posts");
  const tcm = useTranslations("common");

  async function handleDelete() {
    if (!actions.deleteComment) return;
    const ok = await confirm({
      title: tp("deleteCommentTitle"),
      description: tp("deleteCommentBody"),
      confirmLabel: tp("delete"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await actions.deleteComment(comment.id);
      setRemoved(true);
    } catch (e) {
      console.error(e);
    }
    setDeleting(false);
  }

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
      const created = await actions.addReply(chapterId, comment.id, replyText);
      setReplies([
        ...replies,
        {
          id: created?.id ?? Date.now().toString(),
          content: replyText,
          authorName: tcm("you"),
          authorUsername: null,
          authorAvatarUrl: null,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          liked: false,
          canDelete: true,
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

  if (removed) return null;

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
              {tp("reply")}
            </button>
          )}
          {comment.canDelete && actions.deleteComment && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-red-500 disabled:opacity-50"
              aria-label={tc("deleteComment")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tp("delete")}
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <form onSubmit={handleReply} className="mt-3 flex gap-2">
            <Input
              placeholder={tp("replyTo", { name: comment.authorName })}
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

const COMMENTS_PAGE = 10;

export function ChapterView({
  course,
  chapter,
  completed,
  liked,
  favourited,
  likeCount,
  comments,
  commentsTotal,
  commentsHasMore,
  courseComplete,
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
  commentsTotal: number;
  commentsHasMore: boolean;
  courseComplete: boolean;
  completedChapterIds: string[];
  progressPct: number;
  prevChapterId: string | null;
  nextChapterId: string | null;
  actions: Actions;
}) {
  const router = useRouter();
  const t = useTranslations("courses");
  const tp = useTranslations("posts");
  const tcm = useTranslations("common");
  const [isCompleted, setIsCompleted] = useState(completed);
  const [isLiked, setIsLiked] = useState(liked);
  const [isFav, setIsFav] = useState(favourited);
  const [likes, setLikes] = useState(likeCount);
  const [commentText, setCommentText] = useState("");
  const [commentList, setCommentList] = useState<Comment[]>(comments);
  const [hasMoreComments, setHasMoreComments] = useState(commentsHasMore);
  const [totalComments, setTotalComments] = useState(commentsTotal);
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  // Celebrate once per session when the course reaches complete state
  useEffect(() => {
    if (!courseComplete) return;
    const key = `celebrated:${course.id}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setCelebrating(true);
      }
    } catch {
      setCelebrating(true);
    }
  }, [courseComplete, course.id]);

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
      // Re-evaluate course completion (celebration + Finish button)
      router.refresh();
    } catch {
      setIsCompleted(prevState);
    }
  }

  async function handleLoadMoreComments() {
    setLoadingComments(true);
    try {
      const res = await actions.getComments(chapter.id, {
        skip: commentList.length,
        take: COMMENTS_PAGE,
      });
      setCommentList((prev) => [...prev, ...res.comments]);
      setHasMoreComments(res.hasMore);
      setTotalComments(res.total);
    } catch (e) {
      console.error(e);
    }
    setLoadingComments(false);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const created = await actions.addComment(chapter.id, commentText);
      setCommentList([
        {
          id: created?.id ?? Date.now().toString(),
          content: commentText,
          authorName: tcm("you"),
          authorUsername: null,
          authorAvatarUrl: null,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          liked: false,
          canDelete: true,
          replies: [],
        },
        ...commentList,
      ]);
      setTotalComments((n) => n + 1);
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
      {celebrating && (
        <Celebration
          courseTitle={course.title}
          onDone={() => setCelebrating(false)}
        />
      )}
      {/* Breadcrumb */}
      <Link
        href={`/courses/${course.id}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
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
                  className="flex aspect-video w-full items-center justify-center text-white hover:underline"
                >
                  {t("openVideo")} →
                </a>
              ) : (
                <iframe
                  src={getEmbedUrl(chapter.videoUrl, chapter.videoType ?? "youtube")}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
                {t("noVideo")}
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
                    ? "bg-primary/15 text-primary"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                {t("saveFavourite")}
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
                {isCompleted ? t("completed") : t("markComplete")}
              </button>
            </div>
          </div>

          {/* Description */}
          {chapter.description && (
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-2 text-lg font-semibold">{t("aboutChapter")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {chapter.description}
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {tcm("comments")} ({totalComments})
            </h2>

            {/* Comment form */}
            <form onSubmit={handleComment} className="mb-6 flex gap-2">
              <Input
                placeholder={t("writeComment")}
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
                {t("noCommentsYet")}
              </p>
            ) : (
              <>
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
                {hasMoreComments && (
                  <button
                    onClick={handleLoadMoreComments}
                    disabled={loadingComments}
                    className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {loadingComments
                      ? tcm("loading")
                      : `${t("loadMoreComments")} (${t("commentsRemaining", { count: Math.max(0, totalComments - commentList.length) })})`}
                  </button>
                )}
              </>
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
                {tcm("previous")}
              </Link>
            ) : (
              <span />
            )}
            {courseComplete ? (
              <Link
                href={`/courses/${course.id}`}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                <Flag className="h-4 w-4" />
                {tcm("finish")}
              </Link>
            ) : nextChapterId ? (
              <Link
                href={`/courses/${course.id}/chapters/${nextChapterId}`}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                {tcm("next")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("courseComplete")}
              </span>
            )}
          </div>
        </div>

        {/* Chapter sidebar — progress timeline */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{t("courseContent")}</h3>

            {/* Progress percentage */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{tcm("progress")}</span>
                <span className="font-semibold text-primary">
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
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
                            ? "text-primary"
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
                                ? "border-primary bg-primary text-white"
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
