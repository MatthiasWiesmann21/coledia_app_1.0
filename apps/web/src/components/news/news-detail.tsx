"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Send, ArrowLeft, Reply, MessageCircle } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";

type Post = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  gifUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  createdAt: string;
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
  addComment: (id: string, content: string) => Promise<any>;
  addReply: (postId: string, parentId: string, content: string) => Promise<any>;
  toggleCommentLike: (commentId: string, postId: string) => Promise<any>;
  getComments: (postId: string) => Promise<Comment[]>;
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
  postId,
  isLoggedIn,
  currentUserAvatarUrl,
  actions,
  depth,
}: {
  comment: Comment;
  postId: string;
  isLoggedIn: boolean;
  currentUserAvatarUrl: string | null;
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
    if (!isLoggedIn) {
      window.location.href = "/sign-in";
      return;
    }
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
    try {
      await actions.toggleCommentLike(comment.id, postId);
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
      await actions.addReply(postId, comment.id, replyText);
      setReplies([
        ...replies,
        {
          id: Date.now().toString(),
          content: replyText,
          authorName: "You",
          authorUsername: null,
          authorAvatarUrl: currentUserAvatarUrl,
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
          {isLoggedIn && depth < 2 && (
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
        {showReplyForm && isLoggedIn && (
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
                postId={postId}
                isLoggedIn={isLoggedIn}
                currentUserAvatarUrl={currentUserAvatarUrl}
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

export function NewsDetail({
  post,
  liked,
  likeCount,
  commentCount,
  isLoggedIn,
  currentUserAvatarUrl,
  actions,
}: {
  post: Post;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  isLoggedIn: boolean;
  currentUserAvatarUrl: string | null;
  actions: Actions;
}) {
  const [isLiked, setIsLiked] = useState(liked);
  const [likes, setLikes] = useState(likeCount);
  const [commentText, setCommentText] = useState("");
  const [commentList, setCommentList] = useState<Comment[]>([]);
  const [posting, setPosting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  async function handleLike() {
    if (!isLoggedIn) {
      window.location.href = "/sign-in";
      return;
    }
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
    try {
      await actions.toggleLike(post.id);
    } catch {
      setIsLiked(isLiked);
      setLikes(likes);
    }
  }

  async function handleToggleComments() {
    if (!showComments && !commentsLoaded) {
      setLoadingComments(true);
      try {
        const comments = await actions.getComments(post.id);
        setCommentList(comments);
        setCommentsLoaded(true);
      } catch (e) {
        console.error(e);
      }
      setLoadingComments(false);
    }
    setShowComments(!showComments);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await actions.addComment(post.id, commentText);
      setCommentList([
        {
          id: Date.now().toString(),
          content: commentText,
          authorName: "You",
          authorUsername: null,
          authorAvatarUrl: currentUserAvatarUrl,
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

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/news"
        className="mb-4 inline-flex items-center gap-1 text-sm text-(--tenant-primary) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        All news
      </Link>

      {/* Title */}
      <h1 className="text-3xl font-bold">{post.title}</h1>

      {/* Date + category badge */}
      <div className="mt-2 flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {new Date(post.createdAt).toLocaleDateString()}
        </p>
        {post.categoryName && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: `${post.categoryColor ?? "#008080"}20`,
              color: post.categoryColor ?? "#008080",
            }}
          >
            {post.categoryName}
          </span>
        )}
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="mt-6 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={post.title} className="w-full" />
        </div>
      )}

      {/* Content */}
      {post.description && (
        <div className="mt-6 whitespace-pre-wrap text-foreground">
          {post.description}
        </div>
      )}

      {/* Actions: like + comment toggle */}
      <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
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
          onClick={handleToggleComments}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
            showComments
              ? "bg-(--tenant-primary)/15 text-(--tenant-primary)"
              : "border border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          <MessageCircle className={`h-4 w-4 ${showComments ? "fill-current" : ""}`} />
          {commentCount}
        </button>
      </div>

      {/* Comments (lazy-loaded) */}
      {showComments && (
        <div className="mt-6">
          {loadingComments ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading comments...
            </p>
          ) : (
            <>
              {isLoggedIn ? (
                <form onSubmit={handleComment} className="mb-6 flex gap-2">
                  <Input
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={posting || !commentText.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <p className="mb-6 text-sm text-muted-foreground">
                  <Link
                    href="/sign-in"
                    className="text-(--tenant-primary) hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to comment.
                </p>
              )}

              {commentList.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No comments yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {commentList.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      postId={post.id}
                      isLoggedIn={isLoggedIn}
                      currentUserAvatarUrl={currentUserAvatarUrl}
                      actions={actions}
                      depth={0}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
