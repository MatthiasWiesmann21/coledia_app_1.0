"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { upsertQuiz, deleteQuiz, type QuizQuestion } from "@/lib/quiz-actions";

function newQuestion(type: "choice" | "boolean"): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    type,
    question: "",
    options: type === "choice" ? ["", ""] : undefined,
    correctAnswer: type === "choice" ? "" : "true",
    points: 1,
  };
}

export function QuizBuilder({
  chapterId,
  courseId,
  initialQuiz,
}: {
  chapterId: string;
  courseId: string;
  initialQuiz: {
    id: string;
    questions: QuizQuestion[];
    passingScore: number;
    attemptLimit: number | null;
  } | null;
}) {
  const t = useTranslations("quiz");
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialQuiz?.questions ?? [],
  );
  const [passingScore, setPassingScore] = useState(
    initialQuiz?.passingScore ?? 70,
  );
  const [attemptLimit, setAttemptLimit] = useState<string>(
    initialQuiz?.attemptLimit?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function updateOption(qId: string, index: number, value: string) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== qId || !q.options) return q;
        const options = [...q.options];
        options[index] = value;
        // Keep correctAnswer in sync if it referenced the old text
        const patch: Partial<QuizQuestion> = { options };
        if (q.correctAnswer && !options.includes(q.correctAnswer) && index === 0) {
          patch.correctAnswer = value;
        }
        return { ...q, ...patch };
      }),
    );
  }

  function addOption(qId: string) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === qId && q.options ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  }

  function removeOption(qId: string, index: number) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== qId || !q.options) return q;
        const options = q.options.filter((_, i) => i !== index);
        return {
          ...q,
          options,
          correctAnswer:
            q.correctAnswer === q.options[index] ? (options[0] ?? "") : q.correctAnswer,
        };
      }),
    );
  }

  function validate(): string | null {
    for (const q of questions) {
      if (!q.question.trim()) return t("errorEmptyQuestion");
      if (q.type === "choice") {
        const opts = (q.options ?? []).filter((o) => o.trim());
        if (opts.length < 2) return t("errorTooFewOptions");
        if (!q.correctAnswer || !opts.includes(q.correctAnswer)) {
          return t("errorNoCorrectAnswer");
        }
      }
      if (q.points < 1) return t("errorPoints");
    }
    return null;
  }

  async function handleSave() {
    setMsg(null);
    if (questions.length === 0) {
      setMsg(t("errorNoQuestions"));
      return;
    }
    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }
    setSaving(true);
    try {
      // Normalize choice options: drop empty ones
      const normalized = questions.map((q) =>
        q.type === "choice"
          ? { ...q, options: (q.options ?? []).filter((o) => o.trim()) }
          : q,
      );
      await upsertQuiz(chapterId, {
        questions: normalized,
        passingScore,
        attemptLimit: attemptLimit ? parseInt(attemptLimit, 10) : null,
      });
      setMsg(t("saved"));
    } catch {
      setMsg(t("saveFailed"));
    }
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteQuiz(chapterId);
      setQuestions([]);
      setMsg(t("deleted"));
    } catch {
      setMsg(t("deleteFailed"));
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("builderHint")}</p>

      {questions.map((q, qi) => (
        <div
          key={q.id}
          className="rounded-lg border border-border bg-background p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {t("question")} {qi + 1}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {q.type === "choice" ? t("typeChoice") : t("typeBoolean")}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs">{t("points")}</Label>
              <Input
                type="number"
                min={1}
                value={q.points}
                onChange={(e) =>
                  updateQuestion(q.id, { points: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="h-8 w-16"
              />
              <button
                onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                className="rounded p-1 text-red-500 transition hover:bg-red-500/10"
                aria-label={t("deleteQuestion")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Input
            value={q.question}
            onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
            placeholder={t("questionPlaceholder")}
            className="mb-3"
          />

          {q.type === "choice" ? (
            <div className="flex flex-col gap-2">
              {(q.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctAnswer === opt && opt.trim() !== ""}
                    onChange={() => updateQuestion(q.id, { correctAnswer: opt })}
                    className="h-4 w-4"
                    title={t("markCorrect")}
                  />
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(q.id, oi, e.target.value)}
                    placeholder={`${t("option")} ${oi + 1}`}
                  />
                  {(q.options?.length ?? 0) > 2 && (
                    <button
                      onClick={() => removeOption(q.id, oi)}
                      className="rounded p-1 text-muted-foreground transition hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addOption(q.id)} className="self-start">
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("addOption")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{t("correctAnswer")}:</span>
              {["true", "false"].map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctAnswer === v}
                    onChange={() => updateQuestion(q.id, { correctAnswer: v })}
                    className="h-4 w-4"
                  />
                  {v === "true" ? t("true") : t("false")}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, newQuestion("choice")])}>
          <Plus className="mr-1 h-4 w-4" />
          {t("addChoice")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, newQuestion("boolean")])}>
          <Plus className="mr-1 h-4 w-4" />
          {t("addBoolean")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="passingScore">{t("passingScore")}</Label>
          <Input
            id="passingScore"
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="attemptLimit">{t("attemptLimit")}</Label>
          <Input
            id="attemptLimit"
            type="number"
            min={1}
            value={attemptLimit}
            onChange={(e) => setAttemptLimit(e.target.value)}
            placeholder={t("unlimited")}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "..." : t("saveQuiz")}
        </Button>
        {initialQuiz && (
          <Button variant="outline" onClick={handleDelete} disabled={saving}>
            {t("deleteQuiz")}
          </Button>
        )}
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <p className="text-xs text-muted-foreground">
        {t("certificateHint")}
      </p>
    </div>
  );
}
