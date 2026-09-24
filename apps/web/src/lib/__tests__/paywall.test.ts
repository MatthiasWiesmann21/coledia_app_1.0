import { describe, it, expect } from "vitest";
import { prisma, signInAs, withPlan, TENANT } from "@/test/helpers";
import { enrollInCourse, toggleChapterComplete } from "@/lib/course-actions";

const paidCourse = { id: "course-paid", price: 49, userGroups: [] };
const freeCourse = { id: "course-free", price: null, userGroups: [] };

describe("paywall", () => {
  it("rejects enrolling into a paid course via the server action", async () => {
    signInAs("member");
    prisma.course.findFirst.mockResolvedValue(paidCourse);

    await expect(enrollInCourse("course-paid")).rejects.toThrow(/purchased/);
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("looks the course up within the current tenant only", async () => {
    signInAs("member");
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(enrollInCourse("course-of-other-tenant")).rejects.toThrow(/not found/i);
    expect(prisma.course.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "course-of-other-tenant",
      tenantId: TENANT,
      published: true,
    });
  });

  it("allows enrolling into a free course", async () => {
    signInAs("member");
    prisma.course.findFirst.mockResolvedValue(freeCourse);
    prisma.enrollment.upsert.mockResolvedValue({ id: "e1" });

    await expect(enrollInCourse("course-free")).resolves.toEqual({ id: "e1" });
  });

  it("rejects non-members even with a valid session", async () => {
    signInAs("member", "user-1");
    prisma.membership.findUnique.mockResolvedValue(null);

    await expect(enrollInCourse("course-free")).rejects.toThrow(/Forbidden/);
  });

  it("toggleChapterComplete cannot unlock a paid course without enrollment", async () => {
    signInAs("member");
    withPlan("club");
    prisma.chapter.findFirst.mockResolvedValue({
      id: "ch1",
      courseId: "course-paid",
      accessFree: false,
      published: true,
      course: { id: "course-paid", price: 49, published: true, userGroups: [] },
    });
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(toggleChapterComplete("ch1")).rejects.toThrow(/Purchase required/);
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("completing a free preview chapter of a paid course never creates an enrollment", async () => {
    signInAs("member");
    withPlan("club");
    prisma.chapter.findFirst.mockResolvedValue({
      id: "ch-free",
      courseId: "course-paid",
      accessFree: true,
      published: true,
      course: { id: "course-paid", price: 49, published: true, userGroups: [] },
    });
    prisma.chapterProgress.findUnique.mockResolvedValue(null);
    prisma.chapter.count.mockResolvedValue(4);
    prisma.chapterProgress.count.mockResolvedValue(1);
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await toggleChapterComplete("ch-free");
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it("progress counts only published chapters and is capped at 100%", async () => {
    signInAs("member");
    withPlan("starter");
    prisma.chapter.findFirst.mockResolvedValue({
      id: "ch1",
      courseId: "course-free",
      accessFree: false,
      published: true,
      course: { id: "course-free", price: null, published: true, userGroups: [] },
    });
    prisma.chapterProgress.findUnique.mockResolvedValue(null);
    prisma.chapter.count.mockResolvedValue(2);
    prisma.chapterProgress.count.mockResolvedValue(5); // stale rows must not exceed 100
    prisma.enrollment.findUnique.mockResolvedValue({ id: "e1" });

    await toggleChapterComplete("ch1");

    expect(prisma.chapterProgress.count.mock.calls[0][0].where.chapter).toEqual({
      courseId: "course-free",
      published: true,
    });
    expect(prisma.enrollment.update.mock.calls[0][0].data.progressPct).toBe(100);
  });
});
