import { vi, beforeEach } from "vitest";
import { testState } from "./state";

/**
 * Global test mocks: Prisma, session, Next.js cache and side-effect services.
 * Tests get the Prisma mock via `import { prisma } from "@coledia/db"` and
 * control the signed-in user through `testState` (see ./helpers).
 */

vi.mock("@coledia/db", async () => {
  const { createPrismaMock } = await import("./prisma-mock");
  return { prisma: createPrismaMock() };
});

vi.mock("@/lib/session", async () => {
  const { testState: state } = await import("./state");
  const getSession = async () =>
    state.userId
      ? { user: { id: state.userId, email: `${state.userId}@example.com`, name: "Test User" } }
      : null;
  return {
    getSession: vi.fn(getSession),
    requireSession: vi.fn(async () => {
      const s = await getSession();
      if (!s) throw new Error("Unauthorized");
      return s;
    }),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAuditAsync: vi.fn(), logAudit: vi.fn() }));
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhookAsync: vi.fn(),
  dispatchWebhook: vi.fn(),
  generateWebhookSecret: vi.fn(() => "secret"),
}));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));

beforeEach(async () => {
  const { prisma } = (await import("@coledia/db")) as unknown as {
    prisma: import("./prisma-mock").PrismaMock;
  };
  prisma.reset();
  testState.userId = "user-1";
  process.env.TENANT_ID = "tenant-a";
});
