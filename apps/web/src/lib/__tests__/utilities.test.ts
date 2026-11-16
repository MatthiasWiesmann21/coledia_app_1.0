import { describe, it, expect, vi } from "vitest";
import { buildIcsEvent, escapeIcsText, formatIcsDate } from "@/lib/ics";

describe("ics", () => {
  it("formats UTC dates and escapes text", () => {
    expect(formatIcsDate(new Date("2026-09-25T18:30:00.000Z"))).toBe("20260925T183000Z");
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("builds a VEVENT with a default 1h duration", () => {
    const ics = buildIcsEvent({
      uid: "e1@example.com",
      title: "Club night",
      startAt: new Date("2026-09-25T18:00:00Z"),
      location: "Clubhouse",
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260925T180000Z");
    expect(ics).toContain("DTEND:20260925T190000Z");
    expect(ics).toContain("LOCATION:Clubhouse");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});

describe("requireFeatureOrBack", () => {
  it("redirects to the same-origin referer, falling back to /dashboard", async () => {
    const redirect = vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    const headerValues = new Map<string, string>();
    vi.doMock("next/navigation", () => ({ redirect }));
    vi.doMock("next/headers", () => ({ headers: async () => ({ get: (k: string) => headerValues.get(k) ?? null }) }));
    const { prisma } = await import("@/test/helpers");
    prisma.tenant.findUnique.mockResolvedValue({ plan: "starter" });

    const { requireFeatureOrBack } = await import("@/lib/plan");

    headerValues.set("host", "club.example.com");
    headerValues.set("referer", "https://club.example.com/news?page=2");
    await expect(requireFeatureOrBack("liveEvents", "/events")).rejects.toThrow("REDIRECT:/news?page=2");

    headerValues.set("referer", "https://evil.example.org/phish");
    await expect(requireFeatureOrBack("liveEvents", "/events")).rejects.toThrow("REDIRECT:/dashboard");

    headerValues.set("referer", "https://club.example.com/events");
    await expect(requireFeatureOrBack("liveEvents", "/events")).rejects.toThrow("REDIRECT:/dashboard");
  });
});
