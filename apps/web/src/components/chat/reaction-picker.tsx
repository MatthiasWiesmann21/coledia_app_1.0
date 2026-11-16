"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MORE_REACTIONS, QUICK_REACTIONS } from "./chat-types";

/** Popover with quick reactions and an expandable emoji grid. */
export function ReactionPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const t = useTranslations("chat");
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const list = more ? [...QUICK_REACTIONS, ...MORE_REACTIONS] : QUICK_REACTIONS;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t("addReaction")}
      className="z-30 w-64 rounded-xl border border-border bg-card p-2 shadow-lg"
    >
      <div className="grid grid-cols-8 gap-1">
        {list.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-lg transition hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>
      {!more && (
        <button
          type="button"
          onClick={() => setMore(true)}
          className="mt-1 w-full rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
        >
          {t("moreEmojis")}
        </button>
      )}
    </div>
  );
}
