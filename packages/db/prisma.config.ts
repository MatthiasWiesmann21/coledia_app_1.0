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

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
