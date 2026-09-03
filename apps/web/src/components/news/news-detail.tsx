"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Send, ArrowLeft } from "lucide-react";
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
};

export function NewsDetail({
  post,
  liked,
  likeCount,
  comments,
  isLoggedIn,
  currentUserAvatarUrl,
  actions,
}: {
  post: Post;
  liked: boolean;
  likeCount: number;
  comments: Comment[];
  isLoggedIn: boolean;
  currentUserAvatarUrl: string | null;
  actions: {
    toggleLike: (id: string) => Promise<any>;
    addComment: (id: string, content: string) => Promise<any>;
  };
}) {
  const [isLiked, setIsLiked] = useState(liked);
  const [likes, setLikes] = useState(likeCount);
  const [commentText, setCommentText] = useState("");
  const [commentList, setCommentList] = useState(comments);
  const [posting, setPosting] = useState(false);

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
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--tenant-primary)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        All news
      </Link>

      {/* Category badge */}
      {post.categoryName && (
        <span
          className="mb-3 inline-block rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: `${post.categoryColor ?? "#008080"}20`,
            color: post.categoryColor ?? "#008080",
          }}
        >
          {post.categoryName}
        </span>
      )}

      {/* Title */}
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {new Date(post.createdAt).toLocaleDateString()}
      </p>

      {/* Image */}
      {post.imageUrl && (
        <div className="mt-6 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={post.title} className="w-full" />
        </div>
      )}

      {/* Content */}
      {post.description && (
        <div className="mt-6 whitespace-pre-wrap text-[var(--foreground)]">
          {post.description}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3 border-t border-[var(--border)] pt-4">
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
      </div>

      {/* Comments */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">
          Comments ({commentList.length})
        </h2>

        {isLoggedIn ? (
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
        ) : (
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            <Link href="/sign-in" className="text-[var(--tenant-primary)] hover:underline">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}

        {commentList.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
            No comments yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {commentList.map((c) => (
              <li key={c.id} className="flex gap-3">
                {c.authorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.authorAvatarUrl}
                    alt={c.authorName}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-sm font-medium text-white">
                    {c.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
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
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
