"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { hasFeature } from "./plan";
import { issueCertificateForCourse } from "./certificates";

/**
 * Quiz question shape (stored in Quiz.questions JSON):
 * {
 *   id: string,
 *   type: "choice" | "boolean",
 *   question: string,
 *   options?: string[],        // choice only
 *   correctAnswer: string,     // choice: the correct option text; boolean: "true"|"false"
 *   points: number
 * }
 */
export type QuizQuestion = {
  id: string;
  type: "choice" | "boolean";
  question: string;
  options?: string[];
  correctAnswer: string;
  points: number;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId: getTenantId() },
    },
  });

  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
    throw new Error("Forbidden");
  }

  return { session, tenantId: getTenantId() };
}

// ─── Admin: quiz builder ───────────────────────────────────────

export async function upsertQuiz(
  chapterId: string,
  data: {
    questions: QuizQuestion[];
    passingScore: number;
    attemptLimit?: number | null;
  },
) {
  await requireAdmin();

  if (!(await hasFeature("quizzesCertificates"))) {
    throw new Error("plan_required");
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId },
    select: { courseId: true, course: { select: { tenantId: true } } },
  });
  if (!chapter || chapter.course.tenantId !== getTenantId()) {
    throw new Error("Chapter not found");
  }

  const passingScore = Math.max(0, Math.min(100, Math.round(data.passingScore)));
  const attemptLimit =
    data.attemptLimit && data.attemptLimit > 0 ? Math.round(data.attemptLimit) : null;

  const existing = await prisma.quiz.findFirst({ where: { chapterId } });
  const quiz = existing
    ? await prisma.quiz.update({
        where: { id: existing.id },
        data: {
          questions: data.questions as any,
          passingScore,
          attemptLimit,
        },
      })
    : await prisma.quiz.create({
        data: {
          chapterId,
          questions: data.questions as any,
          passingScore,
          attemptLimit,
        },
      });

  revalidatePath(`/admin/courses/${chapter.courseId}/chapters/${chapterId}`);
  return { id: quiz.id };
}

export async function deleteQuiz(chapterId: string) {
  await requireAdmin();

  const quiz = await prisma.quiz.findFirst({ where: { chapterId } });
  if (!quiz) return;

  await prisma.quiz.delete({ where: { id: quiz.id } });
  revalidatePath(`/admin/courses`);
}

// ─── Member: quiz taking ───────────────────────────────────────

export async function getQuizForChapter(chapterId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!(await hasFeature("quizzesCertificates"))) return null;

  const quiz = await prisma.quiz.findFirst({
    where: { chapterId },
    include: {
      attempts: {
        where: { userId: session.user.id },
        orderBy: { attemptedAt: "desc" },
      },
    },
  });
  if (!quiz) return null;

  const questions = (quiz.questions as unknown as QuizQuestion[]).map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options ?? [],
    points: q.points,
    // correctAnswer intentionally omitted for the client
  }));

  return {
    id: quiz.id,
    passingScore: quiz.passingScore,
    attemptLimit: quiz.attemptLimit,
    questions,
    attempts: quiz.attempts.map((a) => ({
      id: a.id,
      score: a.score,
      passed: a.passed,
      attemptedAt: a.attemptedAt.toISOString(),
    })),
  };
}

export async function submitQuizAttempt(
  quizId: string,
  answers: Record<string, string>,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!(await hasFeature("quizzesCertificates"))) {
    throw new Error("plan_required");
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { chapter: { select: { courseId: true, course: { select: { tenantId: true } } } } },
  });
  if (!quiz || quiz.chapter.course.tenantId !== getTenantId()) {
    throw new Error("Quiz not found");
  }

  // Enforce attempt limit (unless the user already passed)
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId, userId: session.user.id },
  });
  const alreadyPassed = attempts.some((a) => a.passed);
  if (alreadyPassed) {
    return { score: 100, passed: true, alreadyPassed: true };
  }
  if (quiz.attemptLimit !== null && attempts.length >= quiz.attemptLimit) {
    throw new Error("attempt_limit_reached");
  }

  // Score server-side
  const questions = quiz.questions as unknown as QuizQuestion[];
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    total += q.points;
    const given = answers[q.id];
    if (given !== undefined && given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
      earned += q.points;
    }
  }
  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const passed = score >= quiz.passingScore;

  await prisma.quizAttempt.create({
    data: {
      userId: session.user.id,
      quizId,
      score,
      passed,
      answers: answers as any,
    },
  });

  // Passing the quiz issues the course certificate
  if (passed) {
    await issueCertificateForCourse(session.user.id, quiz.chapter.courseId);
  }

  return { score, passed, alreadyPassed: false };
}

/** Quiz IDs of a course + whether the current user passed each (member-side). */
export async function getMyQuizStatusForCourse(courseId: string) {
  const session = await getSession();
  if (!session) return [];

  const quizzes = await prisma.quiz.findMany({
    where: { chapter: { courseId, course: { tenantId: getTenantId() } } },
    select: {
      id: true,
      chapterId: true,
      attempts: {
        where: { userId: session.user.id, passed: true },
        select: { id: true },
      },
    },
  });

  return quizzes.map((q) => ({
    quizId: q.id,
    chapterId: q.chapterId,
    passed: q.attempts.length > 0,
  }));
}
