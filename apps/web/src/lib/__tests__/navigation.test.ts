import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma, signInAs, TENANT } from "@/test/helpers";
import { mergeNavigation, requireModule, getUserNavigation } from "@/lib/navigation";
import { saveNavigation } from "@/lib/navigation-actions";
import { registerForEvent, togglePostLike } from "@/lib/content-actions";
import { sendMessage } from "@/lib/chat-message-actions";

const page = (id: string, groups: string[] = [], createdAt = "2026-01-01") => ({
  id,
  title: `Page ${id}`,
  slug: `page-${id}`,
  createdAt: new Date(createdAt),
  userGroups: groups.map((g) => ({ id: g })),
});

/** Module "events" disabled for this tenant. */
function disable(key: string) {
  prisma.navigationItem.findMany.mockResolvedValue([
    { kind: "module", moduleKey: key, customPageId: null, position: 0, enabled: false },
  ]);
}

describe("mergeNavigation", () => {
  it("falls back to the default module order and appends published pages", () => {
    const nav = mergeNavigation([], [page("b", [], "2026-02-01"), page("a")]);
    expect(nav.map((e) => (e.kind === "module" ? e.key : e.id))).toEqual([
      "courses", "dashboard", "news", "events", "chat", "documents", "a", "b",
    ]);
    expect(nav.every((e) => e.enabled)).toBe(true);
  });

  it("respects stored order/state, drops unknown modules and deleted pages", () => {
    const nav = mergeNavigation(
      [
        { kind: "page", moduleKey: null, customPageId: "a", position: 0, enabled: true },
        { kind: "module", moduleKey: "chat", customPageId: null, position: 1, enabled: false },
        { kind: "module", moduleKey: "bogus", customPageId: null, position: 2, enabled: true },
        { kind: "page", moduleKey: null, customPageId: "gone", position: 3, enabled: true },
        { kind: "module", moduleKey: "dashboard", customPageId: null, position: 4, enabled: false },
      ],
      [page("a"), page("new")],
    );
    const ids = nav.map((e) => (e.kind === "module" ? e.key : e.id));
    expect(ids.slice(0, 3)).toEqual(["a", "chat", "dashboard"]);
    expect(ids).not.toContain("bogus");
    expect(ids).not.toContain("gone");
    expect(ids.at(-1)).toBe("new"); // newly published page auto-added at the end
    expect(nav.find((e) => e.kind === "module" && e.key === "chat")!.enabled).toBe(false);
    // Dashboard can't be disabled
    expect(nav.find((e) => e.kind === "module" && e.key === "dashboard")!.enabled).toBe(true);
  });
});

describe("getUserNavigation", () => {
  it("hides disabled modules and group-restricted pages from members outside the group", async () => {
    signInAs("member");
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "organization" });
    prisma.navigationItem.findMany.mockResolvedValue([
      { kind: "module", moduleKey: "news", customPageId: null, position: 0, enabled: false },
    ]);
    prisma.customPage.findMany.mockResolvedValue([page("open"), page("vip", ["g-vip"])]);
    prisma.userGroupMember.findMany.mockResolvedValue([]);

    const nav = await getUserNavigation({ userId: "user-1", tenantId: TENANT, isAdmin: false });
    const ids = nav.map((e) => (e.kind === "module" ? e.key : e.id));
    expect(ids).not.toContain("news");
    expect(ids).toContain("open");
    expect(ids).not.toContain("vip");

    const adminNav = await getUserNavigation({ userId: "user-1", tenantId: TENANT, isAdmin: true });
    expect(adminNav.map((e) => (e.kind === "page" ? e.id : e.key))).toContain("vip");
  });

  it("hides custom pages when the plan has no custom pages", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "starter" });
    prisma.navigationItem.findMany.mockResolvedValue([]);
    prisma.customPage.findMany.mockResolvedValue([page("open")]);
    const nav = await getUserNavigation({ userId: "user-1", tenantId: TENANT, isAdmin: true });
    expect(nav.some((e) => e.kind === "page")).toBe(false);
  });
});

describe("module enforcement", () => {
  it("requireModule blocks members but not admins", async () => {
    disable("events");
    await expect(requireModule("events", { isAdmin: false, tenantId: TENANT })).rejects.toThrow(
      /module disabled/i,
    );
    await expect(requireModule("events", { isAdmin: true, tenantId: TENANT })).resolves.toBeUndefined();
    await expect(requireModule("news", { isAdmin: false, tenantId: TENANT })).resolves.toBeUndefined();
  });

  it("member actions of a disabled module fail", async () => {
    signInAs("member");
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "club" });
    disable("events");
    await expect(registerForEvent("e1")).rejects.toThrow(/module disabled/i);
    expect(prisma.event.findFirst).not.toHaveBeenCalled();

    disable("news");
    await expect(togglePostLike("p1")).rejects.toThrow(/module disabled/i);

    disable("chat");
    await expect(sendMessage("channel:c1", { content: "hi" })).rejects.toThrow(/module disabled/i);
  });

  it("document API returns 404 for members when documents are disabled", async () => {
    signInAs("member");
    disable("documents");
    const { GET } = await import("@/app/api/documents/route");
    const res = await GET(new NextRequest("http://localhost/api/documents"));
    expect(res.status).toBe(404);
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  it("v1 API hides disabled modules", async () => {
    disable("events");
    prisma.apiKey.findUnique.mockResolvedValue({ id: "k1", tenantId: TENANT });
    prisma.apiKey.update.mockResolvedValue({});
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "organization" });
    const { GET } = await import("@/app/api/v1/events/route");
    const res = await GET(
      new NextRequest("http://localhost/api/v1/events", {
        headers: { authorization: "Bearer col_abc" },
      }),
    );
    expect(res.status).toBe(404);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("search skips disabled modules for members", async () => {
    signInAs("member");
    disable("courses");
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "club" });
    prisma.userGroupMember.findMany.mockResolvedValue([]);
    for (const m of ["post", "event", "document", "chatServer", "channel", "directConversation"]) {
      prisma[m].findMany.mockResolvedValue([]);
    }
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(new NextRequest("http://localhost/api/search?q=abc"));
    expect(res.status).toBe(200);
    expect(prisma.course.findMany).not.toHaveBeenCalled();
    expect(prisma.chapter.findMany).not.toHaveBeenCalled();
    expect(prisma.post.findMany).toHaveBeenCalled();
  });
});

describe("saveNavigation", () => {
  it("requires an admin", async () => {
    signInAs("member");
    await expect(saveNavigation([])).rejects.toThrow(/forbidden/i);
  });

  it("rejects unknown module keys", async () => {
    signInAs("admin");
    await expect(saveNavigation([{ kind: "module", key: "billing", enabled: true }])).rejects.toThrow(
      /unknown module/i,
    );
  });

  it("rejects pages of other tenants", async () => {
    signInAs("admin");
    prisma.customPage.count.mockResolvedValue(0);
    await expect(saveNavigation([{ kind: "page", id: "page-of-b", enabled: true }])).rejects.toThrow(
      /invalid page/i,
    );
    expect(prisma.customPage.count).toHaveBeenCalledWith({
      where: { id: { in: ["page-of-b"] }, tenantId: TENANT },
    });
    expect(prisma.navigationItem.createMany).not.toHaveBeenCalled();
  });

  it("replaces the tenant's rows in order and never disables the dashboard", async () => {
    signInAs("admin");
    prisma.customPage.count.mockResolvedValue(1);
    await saveNavigation([
      { kind: "page", id: "p1", enabled: true },
      { kind: "module", key: "dashboard", enabled: false },
      { kind: "module", key: "chat", enabled: false },
    ]);
    expect(prisma.navigationItem.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT } });
    expect(prisma.navigationItem.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: TENANT, kind: "module", moduleKey: "dashboard", position: 1, enabled: true },
        { tenantId: TENANT, kind: "module", moduleKey: "chat", position: 2, enabled: false },
        { tenantId: TENANT, kind: "page", customPageId: "p1", position: 0, enabled: true },
      ],
    });
  });
});
