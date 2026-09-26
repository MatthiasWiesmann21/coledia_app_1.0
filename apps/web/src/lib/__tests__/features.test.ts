import { describe, it, expect } from "vitest";
import { prisma, signInAs, TENANT } from "@/test/helpers";
import { removeFavourite, togglePostFavourite, getPostComments } from "@/lib/content-actions";
import { toggleCourseFavourite } from "@/lib/course-actions";
import { fillEmptyTranslations } from "@/lib/translation-actions";
import { setNotificationPreference } from "@/lib/notification-actions";

describe("favourites", () => {
  it("removeFavourite deletes only the user's row in this tenant", async () => {
    signInAs("member");
    await removeFavourite("course", "c1");

    expect(prisma.favourite.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", tenantId: TENANT, targetType: "course", targetId: "c1" },
    });
  });

  it("removeFavourite rejects unknown target types", async () => {
    signInAs("member");
    await expect(removeFavourite("invoice", "x")).rejects.toThrow(/invalid/i);
    expect(prisma.favourite.deleteMany).not.toHaveBeenCalled();
  });

  it("togglePostFavourite refuses posts that are not visible here", async () => {
    signInAs("admin");
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(togglePostFavourite("post-of-tenant-b")).rejects.toThrow(/not found/i);
    expect(prisma.favourite.findUnique).not.toHaveBeenCalled();
  });

  it("togglePostFavourite creates a tenant-scoped favourite", async () => {
    signInAs("admin");
    prisma.post.findFirst.mockResolvedValue({ id: "p1" });
    prisma.favourite.findUnique.mockResolvedValue(null);

    await togglePostFavourite("p1");
    expect(prisma.favourite.create).toHaveBeenCalledWith({
      data: { userId: "user-1", tenantId: TENANT, targetType: "post", targetId: "p1" },
    });
  });

  it("toggleCourseFavourite refuses courses of other tenants", async () => {
    signInAs("admin");
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(toggleCourseFavourite("course-of-b")).rejects.toThrow();
    expect(prisma.favourite.findUnique).not.toHaveBeenCalled();
  });
});

describe("comment pagination", () => {
  const comment = (id: string, parentId: string | null) => ({
    id,
    parentId,
    userId: "user-2",
    content: `c-${id}`,
    createdAt: new Date("2026-01-01"),
    user: { name: "A", email: "a@x", profiles: [] },
  });

  it("paginates top-level comments at the DB level and keeps replies attached", async () => {
    signInAs("admin");
    prisma.post.findFirst.mockResolvedValue({ id: "p1" });
    prisma.comment.count.mockResolvedValue(10);
    prisma.like.groupBy.mockResolvedValue([]);
    prisma.like.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockImplementation(async (args: {
      where: Record<string, unknown>;
      include?: unknown;
    }) => {
      if (args.where.parentId === null) return [comment("c4", null), comment("c3", null), comment("c2", null)];
      if (args.where.parentId && (args.where.parentId as { in?: string[] }).in)
        return (args.where.parentId as { in: string[] }).in.includes("c4") ? [comment("r1", "c4")] : [];
      if (args.include) return [comment("c4", null), comment("r1", "c4"), comment("c3", null), comment("c2", null)];
      return [];
    });

    const page = await getPostComments("p1", { skip: 0, take: 3 });

    expect(page.total).toBe(10);
    expect(page.hasMore).toBe(true);
    expect(page.comments.map((c) => c.id)).toEqual(["c4", "c3", "c2"]);
    expect(page.comments[0].replies.map((r) => r.id)).toEqual(["r1"]);

    const topQuery = prisma.comment.findMany.mock.calls[0][0];
    expect(topQuery.where).toMatchObject({ postId: "p1", tenantId: TENANT, parentId: null });
    expect(topQuery.skip).toBe(0);
    expect(topQuery.take).toBe(3);
  });

  it("reports hasMore=false on the last page", async () => {
    signInAs("admin");
    prisma.post.findFirst.mockResolvedValue({ id: "p1" });
    prisma.comment.count.mockResolvedValue(5);
    prisma.like.groupBy.mockResolvedValue([]);
    prisma.like.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockImplementation(async (args: {
      where: Record<string, unknown>;
      include?: unknown;
    }) => {
      if (args.where.parentId === null) return [comment("c1", null)];
      if (args.where.parentId && (args.where.parentId as { in?: string[] }).in) return [];
      if (args.include) return [comment("c1", null)];
      return [];
    });

    const page = await getPostComments("p1", { skip: 4, take: 3 });
    expect(page.comments).toHaveLength(1);
    expect(page.hasMore).toBe(false);
    expect(page.total).toBe(5);
  });
});

describe("fillEmptyTranslations", () => {
  const args = {
    entityType: "course",
    entityId: "c1",
    fieldValues: { title: "Hallo", description: "Welt" },
    languages: ["en", "de", "fr", "es"],
  };

  it("requires an admin role", async () => {
    signInAs("member");
    await expect(fillEmptyTranslations(args)).rejects.toThrow(/forbidden/i);
  });

  it("rejects entities that do not belong to this tenant", async () => {
    signInAs("admin");
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(fillEmptyTranslations(args)).rejects.toThrow(/not found/i);
    expect(prisma.translation.createMany).not.toHaveBeenCalled();
  });

  it("fills only empty languages and never the default locale", async () => {
    signInAs("admin");
    prisma.course.findFirst.mockResolvedValue({ id: "c1" });
    // de:title already translated — must not be overwritten
    prisma.translation.findMany.mockResolvedValue([{ field: "title", language: "de" }]);

    const result = await fillEmptyTranslations(args);
    const rows = prisma.translation.createMany.mock.calls[0][0].data as {
      field: string;
      language: string;
      tenantId: string;
    }[];

    expect(rows.every((r) => r.tenantId === TENANT)).toBe(true);
    expect(rows.some((r) => r.language === "en")).toBe(false);
    expect(rows.some((r) => r.field === "title" && r.language === "de")).toBe(false);
    // de:description + fr/es title+description = 5 rows
    expect(rows).toHaveLength(5);
    expect(result.filled).toBe(5);
  });
});

describe("notification preferences", () => {
  it("rejects unknown types and channels", async () => {
    signInAs("member");
    await expect(setNotificationPreference("nope", "email", true)).rejects.toThrow(/invalid/i);
    await expect(setNotificationPreference("new_post", "carrier-pigeon", true)).rejects.toThrow(/invalid/i);
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled();
  });
});
