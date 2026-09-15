// Prisma ORM v7 no longer auto-loads .env files. Load dotenv so the
// runtime client (not just the CLI) picks up DATABASE_URL from .env.
// In production/Dokploy, env vars are set by the container; dotenv
// silently ignores a missing .env, so this is safe everywhere.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Prisma Client singleton (Prisma ORM v7+).
 *
 * v7 requires a driver adapter for all databases. We use
 * `@prisma/adapter-mariadb`, which handles both MySQL and MariaDB and
 * uses the MariaDB driver's `mariadb://` protocol. We normalize Prisma's
 * standard `mysql://` connection string before constructing the adapter.
 *
 * The generated client lives at `src/generated/prisma` (see schema.prisma +
 * prisma.config.ts). All model types and the `Prisma` namespace are
 * re-exported below so consumers can keep importing from `@coledia/db`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let productionClient: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Required by the Prisma MariaDB driver adapter.",
    );
  }
  const adapterUrl = new URL(url.replace(/^mysql:/, "mariadb:"));
  adapterUrl.searchParams.set("connectionLimit", process.env.DATABASE_CONNECTION_LIMIT ?? "2");
  const adapter = new PrismaMariaDb(adapterUrl.toString());
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// Lazily construct the client on first use — NOT at module load.
// Next.js evaluates the root layout while collecting page data during
// `next build`, where DATABASE_URL (a runtime secret) is not set; a
// load-time throw there fails the whole build. The error still fires
// loudly on the first real query when the variable is genuinely missing.
function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }
  productionClient ??= createPrismaClient();
  return productionClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type { PrismaClient } from "./generated/prisma/client";
export * from "./generated/prisma/client";
