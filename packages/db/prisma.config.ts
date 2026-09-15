// Prisma CLI configuration (Prisma ORM v7+).
//
// In v7 the `url`/`shadowDatabaseUrl` fields moved out of the schema's
// `datasource` block and into this config file. The Prisma CLI (migrate,
// db push, db seed, etc.) reads the connection URL from here.
//
// `prisma generate` does not connect to the database, but `env()` evaluates
// at config load time, so we load `packages/db/.env` via dotenv. In
// production/Dokploy the real DATABASE_URL is provided by the environment.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// `prisma generate` never connects to the database, but Prisma v7 still
// evaluates the datasource URL when loading this config. Build environments
// (Railpack/Dokploy, CI) don't have DATABASE_URL set — it's injected at
// runtime — so fall back to a placeholder for generate only. Real
// DB-touching commands (migrate, db push, seed) still require the real
// DATABASE_URL and fail loudly without it.
function resolveDatasourceUrl(): string {
  if (process.env.DATABASE_URL) return env("DATABASE_URL");
  if (process.argv.includes("generate")) {
    return "mysql://placeholder:placeholder@localhost:3306/placeholder";
  }
  return env("DATABASE_URL"); // throws Prisma's clear "cannot resolve" error
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
