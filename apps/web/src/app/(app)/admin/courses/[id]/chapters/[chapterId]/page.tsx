import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { hasFeature } from "@/lib/plan";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { ChapterEditor } from "@/components/admin/chapter-editor";
import { QuizBuilder } from "@/components/admin/quiz-builder";
import type { QuizQuestion } from "@/lib/quiz-actions";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  const { tenantId } = await requireAdmin();

  const course = await prisma.course.findFirst({
    where: { id, tenantId },
    select: { id: true, title: true },
  });

  if (!course) notFound();

  const [chapter, translations] = await Promise.all([
    prisma.chapter.findFirst({
      where: { id: chapterId, courseId: course.id },
    }),
    prisma.translation.findMany({
      where: { entityType: "chapter", entityId: chapterId, tenantId },
    }),
  ]);

  if (!chapter) notFound();

  const quizEnabled = await hasFeature("quizzesCertificates");
  const quiz = quizEnabled
    ? await prisma.quiz.findFirst({ where: { chapterId: chapter.id } })
    : null;

  const translationsMap: Record<string, Record<string, string>> = {};
  for (const tr of translations) {
    if (!translationsMap[tr.language]) translationsMap[tr.language] = {};
    translationsMap[tr.language][tr.field] = tr.value;
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Edit Chapter</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Course: {course.title}
      </p>
      <ChapterEditor
        chapter={{
          id: chapter.id,
          courseId: chapter.courseId,
          title: chapter.title,
          description: chapter.description,
          duration: chapter.duration,
          level: chapter.level,
          author: chapter.author,
          videoUrl: chapter.videoUrl,
          videoType: chapter.videoType,
          accessFree: chapter.accessFree,
          published: chapter.published,
        }}
        translations={translationsMap}
      />

      {/* Quiz (Club+ feature) */}
      <section className="mt-4 max-w-2xl rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          Quiz
          {!quizEnabled && <Lock className="h-4 w-4 text-muted-foreground" />}
        </h2>
        {quizEnabled ? (
          <QuizBuilder
            chapterId={chapter.id}
            courseId={course.id}
            initialQuiz={
              quiz
                ? {
                    id: quiz.id,
                    questions: quiz.questions as unknown as QuizQuestion[],
                    passingScore: quiz.passingScore,
                    attemptLimit: quiz.attemptLimit,
                  }
                : null
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Quizzes and certificates require the Club plan or higher.{" "}
            <Link
              href="/upgrade?feature=quizzesCertificates"
              className="text-(--tenant-primary) hover:underline"
            >
              Upgrade →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
