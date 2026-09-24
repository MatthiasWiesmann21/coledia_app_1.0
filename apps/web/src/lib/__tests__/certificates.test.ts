import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma, withPlan } from "@/test/helpers";

const issueSpy = vi.fn();
vi.mock("pdf-lib", () => ({ PDFDocument: {}, StandardFonts: {}, rgb: vi.fn() }));

describe("certificate rule: all published chapters complete AND all quizzes passed", () => {
  let maybeIssueCertificate: typeof import("@/lib/certificates").maybeIssueCertificate;

  beforeEach(async () => {
    issueSpy.mockReset();
    const mod = await import("@/lib/certificates");
    maybeIssueCertificate = mod.maybeIssueCertificate;
    withPlan("club");
    prisma.course.findFirst.mockResolvedValue({ id: "c1" });
    // Existing certificate short-circuits issuance → lets us detect the call
    prisma.certificate.findUnique.mockImplementation(async () => {
      issueSpy();
      return { id: "already" };
    });
  });

  it("does not issue when a chapter is still incomplete", async () => {
    prisma.chapter.count.mockResolvedValue(3);
    prisma.chapterProgress.count.mockResolvedValue(2);
    prisma.quiz.findMany.mockResolvedValue([]);

    await maybeIssueCertificate("u1", "c1");
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it("does not issue when one quiz is not passed yet", async () => {
    prisma.chapter.count.mockResolvedValue(2);
    prisma.chapterProgress.count.mockResolvedValue(2);
    prisma.quiz.findMany.mockResolvedValue([{ attempts: [{ id: "a" }] }, { attempts: [] }]);

    await maybeIssueCertificate("u1", "c1");
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it("issues when everything is complete and passed", async () => {
    prisma.chapter.count.mockResolvedValue(2);
    prisma.chapterProgress.count.mockResolvedValue(2);
    prisma.quiz.findMany.mockResolvedValue([{ attempts: [{ id: "a" }] }]);

    await maybeIssueCertificate("u1", "c1");
    expect(issueSpy).toHaveBeenCalledOnce();
  });

  it("never issues on plans without certificates", async () => {
    withPlan("starter");
    prisma.chapter.count.mockResolvedValue(1);
    prisma.chapterProgress.count.mockResolvedValue(1);
    prisma.quiz.findMany.mockResolvedValue([]);

    await maybeIssueCertificate("u1", "c1");
    expect(issueSpy).not.toHaveBeenCalled();
  });
});
