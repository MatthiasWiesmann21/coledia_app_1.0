"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";

const CONFETTI_COLORS = [
  "#008080",
  "#f59e0b",
  "#e6550d",
  "#756bb1",
  "#31a354",
  "#e05da8",
];

/** Deterministic pseudo-random in [0,1) — stable across renders. */
function prand(seed: number): number {
  const x = Math.sin(seed * 99991) * 10000;
  return x - Math.floor(x);
}

/**
 * Full-screen confetti burst + "course complete" banner shown when the user
 * finishes a course (all chapters done, all quizzes passed). Pure CSS
 * animation, auto-dismisses after 5s or on click.
 */
export function Celebration({
  courseTitle,
  onDone,
}: {
  courseTitle: string;
  onDone?: () => void;
}) {
  const t = useTranslations("courses");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-hidden"
      aria-live="polite"
    >
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        @keyframes celebration-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${prand(i) * 100}%`,
            width: `${8 + prand(i + 100) * 6}px`,
            height: `${12 + prand(i + 200) * 8}px`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            borderRadius: prand(i + 300) > 0.5 ? "50%" : "2px",
            animation: `confetti-fall ${2.4 + prand(i + 400) * 2.2}s ${prand(i + 500) * 0.8}s ease-in forwards`,
          }}
        />
      ))}

      <div
        className="pointer-events-auto mt-24 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 shadow-2xl"
        style={{ animation: "celebration-pop 0.5s ease-out both" }}
        onClick={() => {
          setVisible(false);
          onDone?.();
        }}
      >
        <Trophy className="h-8 w-8 text-yellow-500" />
        <div>
          <p className="text-lg font-bold">{t("congratulations")}</p>
          <p className="text-sm text-muted-foreground">
            {t("courseFinishedBody")} — {courseTitle}
          </p>
        </div>
      </div>
    </div>
  );
}
