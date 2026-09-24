import { describe, it, expect } from "vitest";
import { prisma, signInAs, TENANT } from "@/test/helpers";
import { deletePost, updatePost, deleteEvent, registerForEvent } from "@/lib/content-actions";
import { deleteCourse, deleteCategory, addUserToGroup } from "@/lib/course-actions";
import { deleteApiKey, updateTenantSettings, updateUserRole, removeUser, updateBranding } from "@/lib/admin-actions";

describe("cross-tenant protection in admin actions", () => {
  it("deletePost is scoped to the current tenant and fails for foreign ids", async () => {
    signInAs("admin");
    prisma.post.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deletePost("post-of-tenant-b")).rejects.toThrow(/not found/i);
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({ where: { id: "post-of-tenant-b", tenantId: TENANT } });
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });

  it("updatePost refuses ids from another tenant", async () => {
    signInAs("admin");
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(updatePost("post-of-tenant-b", { title: "x" })).rejects.toThrow(/not found/i);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it("updatePost rejects user groups that belong to another tenant", async () => {
    signInAs("admin");
    prisma.post.findFirst.mockResolvedValue({ published: false });
    prisma.userGroup.count.mockResolvedValue(0);

    await expect(updatePost("p1", { userGroupIds: ["group-of-b"] })).rejects.toThrow(/user group/i);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it("deleteEvent / deleteCourse / deleteCategory are tenant-scoped", async () => {
    signInAs("admin");
    prisma.event.deleteMany.mockResolvedValue({ count: 0 });
    prisma.course.deleteMany.mockResolvedValue({ count: 0 });
    prisma.category.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteEvent("e")).rejects.toThrow();
    await expect(deleteCourse("c")).rejects.toThrow();
    await expect(deleteCategory("k")).rejects.toThrow();
    expect(prisma.event.deleteMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(prisma.course.deleteMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(prisma.category.deleteMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });

  it("deleteApiKey cannot revoke another tenant's key", async () => {
    signInAs("admin");
    prisma.apiKey.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteApiKey("key-of-b")).rejects.toThrow(/not found/i);
    expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({ where: { id: "key-of-b", tenantId: TENANT } });
    expect(prisma.apiKey.delete).not.toHaveBeenCalled();
  });

  it("addUserToGroup requires the user to be a member of this tenant", async () => {
    signInAs("admin");
    prisma.userGroup.count.mockResolvedValue(1);

    await expect(addUserToGroup("g1", "stranger")).rejects.toThrow(/not a member/);
    expect(prisma.userGroupMember.create).not.toHaveBeenCalled();
  });

  it("members cannot call admin actions", async () => {
    signInAs("member");
    await expect(deletePost("p1")).rejects.toThrow(/Forbidden/);
    expect(prisma.post.deleteMany).not.toHaveBeenCalled();
  });
});

describe("roles and plan", () => {
  it("an admin cannot demote the owner", async () => {
    signInAs("admin", "admin-1", [{ id: "owner-1", role: "owner" }]);

    await expect(updateUserRole("owner-1", "member")).rejects.toThrow(/Only owners/);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("an operator cannot grant admin", async () => {
    signInAs("operator", "op-1", [{ id: "user-2", role: "member" }]);
    await expect(updateUserRole("user-2", "admin")).rejects.toThrow(/Only owners/);
  });

  it("rejects unknown roles", async () => {
    signInAs("owner", "owner-1", [{ id: "user-2", role: "member" }]);
    await expect(updateUserRole("user-2", "superuser")).rejects.toThrow(/Invalid role/);
  });

  it("the last owner cannot be demoted", async () => {
    signInAs("owner", "owner-1", [{ id: "owner-2", role: "owner" }]);
    prisma.membership.count.mockResolvedValue(1);
    await expect(updateUserRole("owner-2", "admin")).rejects.toThrow(/at least one owner/);
  });

  it("an admin cannot remove another admin", async () => {
    signInAs("admin", "admin-1", [{ id: "admin-2", role: "admin" }]);
    await expect(removeUser("admin-2")).rejects.toThrow(/Only owners/);
  });

  it("updateTenantSettings never changes plan or status", async () => {
    signInAs("owner");
    await updateTenantSettings({ name: "New name", plan: "organization", status: "active" } as never);

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT },
      data: { name: "New name" },
    });
  });

  it("updateBranding rejects javascript: URLs and invalid colors", async () => {
    signInAs("operator");
    await expect(updateBranding({ logoClickUrl: "javascript:alert(1)" })).rejects.toThrow(/Invalid URL/);
    await expect(updateBranding({ primaryColorLight: "red;background:url(x)" })).rejects.toThrow(/Invalid color/);
    expect(prisma.branding.upsert).not.toHaveBeenCalled();
  });
});

describe("event registration", () => {
  it("is blocked when the plan has no live events", async () => {
    signInAs("member");
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "starter" });
    await expect(registerForEvent("e1")).rejects.toThrow(/plan_required/);
  });

  it("rejects registrations when the event is full", async () => {
    signInAs("member");
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "club" });
    prisma.userGroupMember.findMany.mockResolvedValue([]);
    prisma.event.findFirst.mockResolvedValue({ id: "e1", maxAttendees: 2 });
    prisma.eventRegistration.findUnique.mockResolvedValue(null);
    prisma.eventRegistration.count.mockResolvedValue(2);

    await expect(registerForEvent("e1")).rejects.toThrow(/full/);
    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
  });

  it("only finds published, tenant-owned events for members", async () => {
    signInAs("member");
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "club" });
    prisma.userGroupMember.findMany.mockResolvedValue([]);
    prisma.event.findFirst.mockResolvedValue(null);

    await expect(registerForEvent("e-of-b")).rejects.toThrow(/Not found/);
    expect(prisma.event.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "e-of-b",
      tenantId: TENANT,
      published: true,
    });
  });
});
