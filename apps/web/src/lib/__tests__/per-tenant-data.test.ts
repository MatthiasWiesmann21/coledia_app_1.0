import { describe, it, expect, vi } from "vitest";
import { prisma, signInAs, TENANT } from "@/test/helpers";
import { acceptTerms, updateProfile, setUserLanguage } from "@/lib/actions";
import { getNotificationPreferences, setNotificationPreference } from "@/lib/notification-actions";

vi.mock("@/components/terms-modal", () => ({ TermsModal: () => null }));
vi.mock("@/components/dashboard-content", () => ({ DashboardContent: () => null }));

describe("per-tenant profile", () => {
  it("acceptTerms writes the profile of the current tenant only", async () => {
    signInAs("member");
    await acceptTerms();

    const args = prisma.userProfile.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_tenantId: { userId: "user-1", tenantId: TENANT } });
    expect(args.create).toMatchObject({ userId: "user-1", tenantId: TENANT });
  });

  it("updateProfile checks username uniqueness within the tenant", async () => {
    signInAs("member");
    prisma.userProfile.findFirst.mockResolvedValue({ id: "other" });

    await expect(updateProfile({ username: "taken" })).rejects.toThrow(/already taken/);
    expect(prisma.userProfile.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT, username: "taken" });
  });

  it("setUserLanguage is per tenant and validated", async () => {
    signInAs("member");
    await expect(setUserLanguage("xx")).rejects.toThrow(/Invalid language/);
    await setUserLanguage("de");
    expect(prisma.userProfile.upsert.mock.calls[0][0].where).toEqual({
      userId_tenantId: { userId: "user-1", tenantId: TENANT },
    });
  });

  it("profile actions require membership in this tenant", async () => {
    signInAs("member");
    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(acceptTerms()).rejects.toThrow(/Forbidden/);
  });
});

describe("per-tenant notification preferences", () => {
  it("reads and writes preferences for the current tenant", async () => {
    signInAs("member");
    prisma.notificationPreference.findMany.mockResolvedValue([]);

    await getNotificationPreferences();
    expect(prisma.notificationPreference.findMany.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      tenantId: TENANT,
    });

    await setNotificationPreference("new_post", "email", true);
    expect(prisma.notificationPreference.upsert.mock.calls[0][0].where).toEqual({
      userId_tenantId_type_channel: { userId: "user-1", tenantId: TENANT, type: "new_post", channel: "email" },
    });
  });
});

describe("dashboard shows only this tenant's data", () => {
  it("scopes every per-user query to the current tenant", async () => {
    signInAs("member");
    for (const m of ["enrollment", "eventRegistration", "comment", "favourite", "membership", "course"] as const) {
      prisma[m].findMany.mockResolvedValue([]);
    }
    prisma.chapterProgress.count.mockResolvedValue(0);
    prisma.membership.count.mockResolvedValue(0);

    const { default: DashboardPage } = await import("@/app/(app)/dashboard/page");
    await DashboardPage();

    expect(prisma.userProfile.findUnique.mock.calls[0][0].where).toEqual({
      userId_tenantId: { userId: "user-1", tenantId: TENANT },
    });
    expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      course: { tenantId: TENANT },
    });
    expect(prisma.chapterProgress.count.mock.calls[0][0].where).toMatchObject({
      userId: "user-1",
      chapter: { course: { tenantId: TENANT } },
    });
    expect(prisma.favourite.findMany.mock.calls[0][0].where).toMatchObject({
      userId: "user-1",
      tenantId: TENANT,
    });
    expect(prisma.eventRegistration.findMany.mock.calls[0][0].where.event.tenantId).toBe(TENANT);
    expect(prisma.comment.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT);

    // Presence comes from this tenant's memberships, never from global sessions
    expect(prisma.membership.count.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(prisma.session.count).not.toHaveBeenCalled();
    expect(prisma.session.findMany).not.toHaveBeenCalled();
  });
});
