"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CornerUpLeft, FileText, Loader2, Paperclip, Pencil, Send, X } from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import { ChatAvatar } from "./chat-avatar";
import type { ChatMember, SendInput, UIMessage, UploadedAttachment } from "./chat-types";

const MAX_LENGTH = 4000;
const TYPING_THROTTLE_MS = 3000;
const TYPING_IDLE_MS = 5000;

type PendingFile = { key: string; file: File; status: "uploading" | "done" | "error"; result?: UploadedAttachment; error?: string };

/** Turn stored `<@id>` tokens into "@Name" for editing, remembering the mapping. */
function tokensToDisplay(content: string, nameOf: (id: string) => string, map: Map<string, string>) {
  return content.replace(/<@([A-Za-z0-9_-]{1,64})>/g, (_, id: string) => {
    const name = nameOf(id);
    map.set(name, id);
    return `@${name}`;
  });
}

/** Turn "@Name" back into `<@id>` tokens for names picked from the autocomplete. */
function displayToTokens(content: string, map: Map<string, string>) {
  let out = content;
  for (const [name, id] of [...map.entries()].sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(`@${name}`).join(`<@${id}>`);
  }
  return out;
}

export function Composer({
  roomKey,
  members,
  meId,
  placeholder,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onEditLast,
}: {
  roomKey: string;
  members: ChatMember[];
  meId: string;
  placeholder: string;
  replyTo: UIMessage | null;
  editing: UIMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (input: SendInput) => void;
  onSaveEdit: (message: UIMessage, content: string) => void;
  onEditLast: () => void;
}) {
  const t = useTranslations("chat");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mentionMap = useRef(new Map<string, string>());
  const lastTypingSent = useRef(0);
  const typingIdle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameOf = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m.name]));
    return (id: string) => byId.get(id) ?? t("unknownUser");
  }, [members, t]);

  function sendTyping(typing: boolean) {
    void fetch("/api/chat/typing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: roomKey, typing }),
    }).catch(() => {});
  }

  function stopTyping() {
    if (typingIdle.current) clearTimeout(typingIdle.current);
    typingIdle.current = null;
    if (lastTypingSent.current) {
      lastTypingSent.current = 0;
      sendTyping(false);
    }
  }

  // The parent remounts the composer per room (key), so only stop typing on unmount
  useEffect(() => {
    return () => stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load message into the box when editing starts
  useEffect(() => {
    if (!editing) return;
    const map = new Map<string, string>();
    for (const m of editing.mentions) map.set(m.name, m.id);
    setText(tokensToDisplay(editing.content ?? "", nameOf, map));
    mentionMap.current = map;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [editing, nameOf]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Auto-size
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.id !== meId)
      .filter((m) => m.name.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, members, meId]);

  function updateMentionQuery(value: string, caret: number) {
    const match = /(?:^|\s)@([\p{L}\p{N}_.-]{0,30})$/u.exec(value.slice(0, caret));
    setMentionQuery(match ? match[1] : null);
    setMentionIndex(0);
  }

  function insertMention(member: ChatMember) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@([\p{L}\p{N}_.-]{0,30})$/u, `@${member.name} `);
    const next = before + text.slice(caret);
    mentionMap.current.set(member.name, member.id);
    setText(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  }

  function handleChange(value: string, caret: number) {
    setText(value);
    updateMentionQuery(value, caret);
    if (editing) return;
    const now = Date.now();
    if (value && now - lastTypingSent.current > TYPING_THROTTLE_MS) {
      lastTypingSent.current = now;
      sendTyping(true);
    }
    if (typingIdle.current) clearTimeout(typingIdle.current);
    typingIdle.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    if (!value) stopTyping();
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const added = [...list].slice(0, 10 - files.length).map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      file,
      status: "uploading" as const,
    }));
    setFiles((prev) => [...prev, ...added]);
    await Promise.all(
      added.map(async (p) => {
        const form = new FormData();
        form.append("room", roomKey);
        form.append("file", p.file);
        try {
          const res = await fetch("/api/chat/attachments", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? t("uploadFailed"));
          setFiles((prev) => prev.map((f) => (f.key === p.key ? { ...f, status: "done", result: data } : f)));
        } catch (e) {
          const message = e instanceof Error ? e.message : t("uploadFailed");
          setFiles((prev) => prev.map((f) => (f.key === p.key ? { ...f, status: "error", error: message } : f)));
        }
      }),
    );
  }

  const uploading = files.some((f) => f.status === "uploading");
  const ready = files.filter((f) => f.status === "done" && f.result).map((f) => f.result!);
  const trimmed = text.trim();
  const canSend = !uploading && (trimmed.length > 0 || (!editing && ready.length > 0)) && trimmed.length <= MAX_LENGTH;

  function submit() {
    if (!canSend) return;
    const content = displayToTokens(trimmed, mentionMap.current);
    stopTyping();
    if (editing) {
      onSaveEdit(editing, content);
    } else {
      onSend({ content, replyToId: replyTo?.id ?? null, attachments: ready });
      setFiles([]);
    }
    setText("");
    mentionMap.current = new Map();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setMentionIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      if (editing) {
        onCancelEdit();
        setText("");
      } else if (replyTo) onCancelReply();
    } else if (e.key === "ArrowUp" && !text && !editing) {
      e.preventDefault();
      onEditLast();
    }
  }

  return (
    <div className="border-t border-border bg-card px-3 pb-3 pt-2">
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
          {editing ? <Pencil className="h-3.5 w-3.5 shrink-0" /> : <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />}
          <span className="min-w-0 flex-1 truncate">
            {editing ? (
              t("editingMessage")
            ) : (
              <>
                {t("replyingTo")} <span className="font-semibold">{replyTo!.author.name}</span>
                {replyTo!.content && (
                  <span className="text-muted-foreground"> — {tokensToDisplay(replyTo!.content, nameOf, new Map())}</span>
                )}
              </>
            )}
          </span>
          <button
            type="button"
            aria-label={t("cancel")}
            onClick={() => {
              if (editing) {
                onCancelEdit();
                setText("");
              } else onCancelReply();
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <li
              key={f.key}
              className={cn(
                "flex max-w-[14rem] items-center gap-2 rounded-lg border px-2 py-1 text-xs",
                f.status === "error" ? "border-red-500/50 text-red-600" : "border-border",
              )}
              title={f.error}
            >
              {f.status === "uploading" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{f.file.name}</span>
              <span className="shrink-0 text-muted-foreground">{formatFileSize(f.file.size)}</span>
              <button
                type="button"
                aria-label={t("removeAttachment")}
                onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                className="shrink-0 rounded hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative flex items-end gap-2">
        {suggestions.length > 0 && (
          <ul className="absolute bottom-full left-10 z-20 mb-2 w-64 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
            {suggestions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                    i === mentionIndex ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <ChatAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                  <span className="truncate">{m.name}</span>
                  {m.username && <span className="truncate text-xs text-muted-foreground">@{m.username}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!editing && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label={t("attachFile")}
              title={t("attachFile")}
              onClick={() => fileRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          maxLength={MAX_LENGTH + 200}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setMentionQuery(null), 100)}
          onPaste={(e) => {
            if (e.clipboardData.files.length && !editing) {
              e.preventDefault();
              void addFiles(e.clipboardData.files);
            }
          }}
          className="max-h-[200px] min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={editing ? t("saveEdit") : t("send")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground">
        <span>{t("composerHint")}</span>
        {trimmed.length > MAX_LENGTH - 300 && (
          <span className={cn(trimmed.length > MAX_LENGTH && "text-red-600")}>
            {trimmed.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
