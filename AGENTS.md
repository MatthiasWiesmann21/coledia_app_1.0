# Coledia — Project Guide

## Overview
Coledia is a multi-tenant community LMS for clubs, associations, and small teams.
It's the successor to Clubyte, rebuilt with a modern TypeScript stack.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind v4
- **Backend**: Next.js Server Components + Server Actions + Route Handlers, Better-Auth
- **Database**: MySQL via Prisma ORM v7 (single shared DB, `tenantId` on all tenant-scoped tables)
- **Realtime**: Socket.io (text channels + DMs only)
- **Payments**: Stripe (subscriptions + one-time course sales)
- **Deploy**: Dokploy — each client gets its own container, all share the same MySQL DB

## Workspace Structure
```
apps/
  web/          — Next.js full-stack app
  realtime/     — Socket.io service
packages/
  config/       — Shared tsconfig presets
  db/           — Prisma schema + client + tenant-scoped extension
  ui/           — Shared UI components + brand tokens + TenantTheme provider
  shared/       — Zod schemas + constants (plans, roles, enums)
```

## Commands
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm dev              # Start dev servers (web + realtime)
pnpm typecheck        # TypeScript check all packages
pnpm lint             # ESLint all packages
pnpm db:generate      # Generate Prisma client
pnpm db:migrate:dev   # Create + apply a new migration
pnpm db:migrate       # Apply migrations (production)
pnpm db:push          # Push schema without migration (dev only)
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed dev tenant + admin user
```

## Local Dev Setup
1. Copy env: `cp apps/web/.env.example apps/web/.env`
2. Set `DATABASE_URL` to your MySQL connection string
3. Set `TENANT_ID` to a tenant cuid (create one via seed script)
4. Set `BETTER_AUTH_SECRET` to a random string
5. Generate Prisma client: `pnpm db:generate`
6. Run migrations: `pnpm db:migrate:dev`
7. Seed: `pnpm db:seed`
8. Start dev server: `pnpm dev`
9. Access: `http://localhost:3000`

## Multi-tenancy
- Single MySQL database with `tenantId` on all tenant-scoped rows
- **Tenant resolution via `TENANT_ID` env var** — each Dokploy container knows its tenant
- Isolation enforced by: Prisma `tenantScoped()` extension (auto-filters all queries)
- `getTenantId()` in `src/lib/tenant.ts` reads the env var

## Key Decisions
- **Deployment**: Dokploy containers, not Docker Compose. Each client = own container, shared DB.
- **Tenant identity**: `TENANT_ID` env var per container, not hostname parsing.
- **Audio/video chat**: Out of scope. Chat is text channels + DMs only.
- **Documents module**: Full Doc-Hub with local file storage. Admins manage folders/files at `/admin/documents`, users browse at `/documents`. Files stored in `uploads/{tenantId}/` on disk. Visibility per folder via `visible`/`published`/`userGroupId`. Image uploads (avatars, logos, thumbnails) via `/api/upload/images`. Document uploads via `/api/upload/documents`. Files served from `/api/uploads/[...path]`.
- **Pricing**: Starter (free, ≤50 members) / Club (29 CHF, ≤250) / Organization (69 CHF, unlimited + API)

## Prisma ORM v7

- **Version**: `prisma` + `@prisma/client` + `@prisma/adapter-mariadb` all at `^7`. Pinned at root and in `@coledia/db` so `npx prisma` from anywhere resolves to v7 (not a fetched v8 RC).
- **Config**: `packages/db/prisma.config.ts` holds `datasource.url` (loaded via `dotenv`). The schema's `datasource` block only has `provider = "mysql"` — no `url`.
- **Generator**: `prisma-client` (not `prisma-client-js`), output to `packages/db/src/generated/prisma`. Generated client is gitignored; `pnpm db:generate` (or turbo `build`/`typecheck`) regenerates it.
- **Client**: `@coledia/db` centralizes `PrismaClient` instantiation with a `@prisma/adapter-mariadb` driver adapter. All apps import `{ prisma, Prisma, PrismaClient }` from `@coledia/db` — never directly from `@prisma/client`.
- **Workflow changes in v7**: `migrate dev` / `db push` no longer auto-run `generate` or `seed` — run them explicitly. Env vars are not auto-loaded by the CLI; `prisma.config.ts` loads `dotenv` for local dev.
- **Website repo**: The website (separate repo) shares schema columns + a compat test. After upgrading this repo to v7, the website's Prisma 6 client must still parse the shared schema. Update the website client schema and run the compat test after any shared-column change.

## Controlcenter database ownership

- This repository is the sole migration authority for the shared database, including the website's `OwnerAccount` and `Container` tables. Review and apply additive migrations here; never run `db push` or independent migrations from the website's partial client schema.
- The website creates `Tenant`, default `Branding`, and `Membership(role=owner)` records transactionally. Owner tiers control container counts (free=1, club=3, organization=unlimited); they do not overwrite `Tenant.plan` or the app's Stripe subscription fields.
- The website uses the same Better-Auth identity tables and secret, but a distinct host-only cookie prefix and its own `BETTER_AUTH_URL`. Shared credentials do not imply cross-domain SSO. Never set `TENANT_ID` on the website.
- Container deletion retains tenant rows and reserves domains. Live provisioning must preserve uploaded files outside disposable containers for the six-month retention period; permanent purge is not implemented in Phase 1.
- After changing shared scalar columns, update the website client schema, regenerate both Prisma clients, and run the website's schema-compatibility test with both repositories checked out (or `COLEDIA_APP_SCHEMA` set).

## Plan
The detailed rebuild plan is at `C:\Users\Matth\.devin\plans\plan-5ed63b6055023764.md`.
