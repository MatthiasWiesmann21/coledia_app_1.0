# Coledia — Project Guide

## Overview
Coledia is a multi-tenant community LMS for clubs, associations, and small teams.
It's the successor to Clubyte, rebuilt with a modern TypeScript stack.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind v4
- **Backend**: Next.js Server Components + Server Actions + Route Handlers, Better-Auth
- **Database**: MySQL via Prisma ORM (single shared DB, `tenantId` on all tenant-scoped tables)
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

## Controlcenter integration (internal API)
The Coledia Controlcenter (separate repo, customer self-service: sign-up →
Stripe subscription → container provisioning) talks to this app via
`POST/PATCH /api/internal/tenants` (`apps/web/src/app/api/internal/tenants/`),
protected by `Authorization: Bearer $INTERNAL_API_SECRET` (see
`apps/web/src/lib/internal-auth.ts`). POST seeds Tenant (+ Branding + owner
User/Membership) with an explicit UUID id chosen by the Controlcenter
(stored on `Tenant.id`; the Controlcenter's container id is kept in
`Tenant.externalRef` for idempotency). PATCH syncs name/subdomain/plan/
branding and can suspend/reactivate tenants (`status: suspended|cancelled`
is enforced by the guard in `AppShell`).

POST also accepts `ownerUsername` + `ownerPasswordHash` (a better-auth scrypt
hash produced by the Controlcenter — plaintext never crosses systems) to seed
a custom owner: the User is created `emailVerified: false` plus a credential
Account and UserProfile.username. The owner verifies on the app itself —
the Controlcenter calls `/api/auth/send-verification-email` on the new
container once it is deployed.

## Plan
The detailed rebuild plan is at `C:\Users\Matth\.devin\plans\plan-5ed63b6055023764.md`.
