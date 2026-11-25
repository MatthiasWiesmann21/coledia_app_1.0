import { describe, it, expect, vi } from "vitest";
import { prisma, signInAs, TENANT } from "@/test/helpers";
import { requireMember } from "@/lib/guards";
import { isVerificationRequired } from "@/lib/verification";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => {}) }));

function tenantRequiresVerification(required: boolean) {
  prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, plan: "club", requireEmailVerification: required });
}

describe("isVerificationRequired", () => {
  it("only gates unverified non-admins when the tenant requires it", () => {
    expect(isVerificationRequired(false, false, "member")).toBe(false);
    expect(isVerificationRequired(true, true, "member")).toBe(false);
    expect(isVerificationRequired(true, false, "member")).toBe(true);
    for (const role of ["owner", "admin", "operator"]) {
      expect(isVerificationRequired(true, false, role)).toBe(false);
    }
  });
});

describe("requireMember verification gate", () => {
  it("lets unverified members in by default (direct sign-up)", async () => {
    signInAs("member");
    tenantRequiresVerification(false);
    await expect(requireMember()).resolves.toMatchObject({ userId: "user-1" });
  });

  it("blocks unverified members when the tenant requires verification", async () => {
    signInAs("member");
    tenantRequiresVerification(true);
    await expect(requireMember()).rejects.toThrow(/email not verified/i);
  });

  it("never blocks admins", async () => {
    signInAs("admin");
    tenantRequiresVerification(true);
    await expect(requireMember()).resolves.toMatchObject({ isAdmin: true });
  });
});

describe("sign-up hook", () => {
  async function runCreateAfter(user: { id: string; email: string; name: string; emailVerified: boolean }) {
    const { auth } = await import("@/lib/auth");
    const after = auth.options.databaseHooks?.user?.create?.after as (u: unknown) => Promise<void>;
    await after(user);
    // the mail is sent in the background
    await new Promise((r) => setTimeout(r, 20));
  }

  it("creates the membership and doesn't send a verification mail by default", async () => {
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail).mockClear();
    tenantRequiresVerification(false);
    await runCreateAfter({ id: "u-new", email: "new@example.com", name: "New", emailVerified: false });

    expect(prisma.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: "u-new", tenantId: TENANT, role: "member" } }),
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the verification mail in the background when required", async () => {
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail).mockClear();
    tenantRequiresVerification(true);
    await runCreateAfter({ id: "u-new", email: "new@example.com", name: "New", emailVerified: false });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(sendEmail).mock.calls[0][0];
    expect(msg.to).toBe("new@example.com");
    expect(msg.text).toMatch(/\/api\/auth\/verify-email\?token=.+&callbackURL=%2Fdashboard/);
  });

  it("skips already verified users (e.g. Google sign-up)", async () => {
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail).mockClear();
    tenantRequiresVerification(true);
    await runCreateAfter({ id: "u-g", email: "g@example.com", name: "G", emailVerified: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
