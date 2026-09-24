import { vi, type Mock } from "vitest";

/**
 * Auto-mocking Prisma stand-in: every `prisma.<model>.<method>` is a vi.fn()
 * created on first access (default resolves to null). `$transaction` runs
 * callbacks against the same mock or awaits arrays of promises.
 */
export type PrismaMock = Record<string, Record<string, Mock>> & {
  $transaction: Mock;
  $queryRaw: Mock;
  reset: () => void;
};

export function createPrismaMock(): PrismaMock {
  const models = new Map<string, Record<string, Mock>>();

  const modelProxy = (name: string) => {
    if (!models.has(name)) {
      const methods: Record<string, Mock> = {};
      models.set(
        name,
        new Proxy(methods, {
          get(target, method: string) {
            if (!target[method]) target[method] = vi.fn().mockResolvedValue(null);
            return target[method];
          },
        }),
      );
    }
    return models.get(name)!;
  };

  const self: PrismaMock = new Proxy({} as PrismaMock, {
    get(_target, prop: string) {
      if (prop === "reset") return () => models.clear();
      if (prop === "$transaction") return transaction;
      if (prop === "$queryRaw") return queryRaw;
      if (prop === "then") return undefined;
      return modelProxy(prop);
    },
  });

  const transaction = vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: PrismaMock) => unknown)(self) : Promise.all(arg as unknown[]),
  );
  const queryRaw = vi.fn().mockResolvedValue([]);

  return self;
}
