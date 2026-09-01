# Coledia — Project Guide

## Overview
Coledia is a multi-tenant community LMS for clubs, associations, and small teams.
It's the successor to Clubyte, rebuilt with a modern TypeScript stack.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind v4
- **Backend**: Next.js Server Components + API routes, Better-Auth
- **Database**: MySQL 8 via Prisma ORM (single shared DB, `tenantId` on all tenant-scoped tables)
- **Realtime**: Socket.io (text channels + DMs only)
- **File storage**: MinIO (S3-compatible)
- **Cache/queues**: Redis
- **Payments**: Stripe (subscriptions + one-time course sales)
- **Deploy**: VPS + Docker Compose + Caddy (on-demand TLS for custom club domains)

## Workspace Structure
```
apps/
  web/          — Next.js full-stack app (port 3000)
  realtime/     — Socket.io service (port 3001)
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
```

## Local Dev Setup
1. Start infrastructure: `docker compose -f docker/compose.yml up -d`
2. Copy env: `cp apps/web/.env.example apps/web/.env`
3. Generate Prisma client: `pnpm db:generate`
4. Run migrations: `pnpm db:migrate:dev`
5. Start dev server: `pnpm dev`
6. Access: `http://localhost:3000` (marketing site)

### Tenant testing
Use subdomains on `localhost`:
- `http://acme.localhost:3000` → tenant with subdomain `acme`

## Multi-tenancy
- Single MySQL database with `tenantId` on all tenant-scoped rows
- Tenant resolution by hostname (subdomain or custom domain)
- Isolation enforced by: Prisma `tenantScoped()` extension + MySQL restricted views + least-privilege DB role
- Middleware sets `x-tenant-type` and `x-tenant-identifier` headers

## Key Decisions
- **Audio/video chat**: Out of scope. Chat is text channels + DMs only.
- **Documents module**: Route + nav item exist, but CRUD is deferred. Placeholder page for now.
- **Pricing**: Starter (free, ≤50 members) / Club (29 CHF, ≤250) / Organization (69 CHF, unlimited + API)

## Plan
The detailed rebuild plan is at `C:\Users\Matth\.devin\plans\plan-5ed63b6055023764.md`.
