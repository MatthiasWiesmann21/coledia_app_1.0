"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { CheckCircle2, XCircle, Award } from "lucide-react";
import { submitQuizAttempt } from "@/lib/quiz-actions";

type ClientQuestion = {
  id: string;
  type: "choice" | "boolean";
  question: string;
  options: string[];
  points: number;
};

type AttemptInfo = {
  id: string;
  score: number;
  passed: boolean;
  attemptedAt: string;
};

export function QuizPlayer({
  quiz,
}: {
  quiz: {
    id: string;
    passingScore: number;
    attemptLimit: number | null;
    questions: ClientQuestion[];
    attempts: AttemptInfo[];
  };
}) {
  const t = useTranslations("quiz");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptInfo[]>(quiz.attempts);
  const [pending, startTransition] = useTransition();

  const alreadyPassed = attempts.some((a) => a.passed);
  const attemptsLeft =
    quiz.attemptLimit !== null ? quiz.attemptLimit - attempts.length : null;
  const locked = attemptsLeft !== null && attemptsLeft <= 0 && !alreadyPassed;

  function submit() {
    setError(null);
    const unanswered = quiz.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setError(t("answerAll"));
      return;
    }
    startTransition(async () => {
      try {
        const res = await submitQuizAttempt(quiz.id, answers);
        setResult({ score: res.score, passed: res.passed });
        if (!res.alreadyPassed) {
          setAttempts((prev) => [
            {
              id: crypto.randomUUID(),
              score: res.score,
              passed: res.passed,
              attemptedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } catch (e) {
        setError(
          e instanceof Error && e.message === "attempt_limit_reached"
            ? t("attemptLimitReached")
            : t("submitFailed"),
        );
      }
    });
  }

  if (alreadyPassed) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <h2 className="font-semibold">{t("passed")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("passedDetail", { score: attempts[0]?.score ?? 0 })}
            </p>
          </div>
          <Award className="ml-auto h-5 w-5 text-(--tenant-primary)" />
        </div>
      </section>
    );
  }

  if (locked) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <XCircle className="h-6 w-6 text-red-500" />
          <div>
            <h2 className="font-semibold">{t("attemptLimitReached")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("contactAdmin")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold">{t("quizTitle")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("passingInfo", { score: quiz.passingScore })}
        {attemptsLeft !== null && ` · ${t("attemptsLeft", { count: attemptsLeft })}`}
      </p>

      <div className="flex flex-col gap-5">
        {quiz.questions.map((q, qi) => (
          <div key={q.id}>
            <p className="mb-2 text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            {q.type === "choice" ? (
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === opt}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: opt }))
                      }
                      className="h-4 w-4"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex gap-3">
                {(["true", "false"] as const).map((v) => (
                  <label
                    key={v}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === v}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      className="h-4 w-4"
                    />
                    {v === "true" ? t("true") : t("false")}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {result && (
        <div
          className={`mt-4 flex items-center gap-3 rounded-lg border p-3 text-sm ${
            result.passed
              ? "border-green-500/40 bg-green-500/10 text-green-600"
              : "border-red-500/40 bg-red-500/10 text-red-500"
          }`}
        >
          {result.passed ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              {t("resultPassed", { score: result.score })}
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5" />
              {t("resultFailed", { score: result.score, needed: quiz.passingScore })}
            </>
          )}
        </div>
      )}

      <Button onClick={submit} disabled={pending} className="mt-4">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </section>
  );
}
