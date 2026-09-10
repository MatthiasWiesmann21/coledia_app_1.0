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
 * accepts the standard `mysql://` connection string (it rewrites it to
 * `mariadb://` internally).
 *
 * The generated client lives at `src/generated/prisma` (see schema.prisma +
 * prisma.config.ts). All model types and the `Prisma` namespace are
 * re-exported below so consumers can keep importing from `@coledia/db`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Required by the Prisma MariaDB driver adapter.",
    );
  }
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient } from "./generated/prisma/client";
export * from "./generated/prisma/client";
