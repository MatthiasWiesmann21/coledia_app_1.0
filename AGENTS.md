# Coledia — Project Guide

## Overview
Coledia is a multi-tenant community LMS for clubs, associations, and small teams.
It's the successor to Clubyte, rebuilt with a modern TypeScript stack.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind v4
- **Backend**: Next.js Server Components + Server Actions + Route Handlers, Better-Auth
- **Database**: MySQL via Prisma ORM (single shared DB, `tenantId` on all tenant-scoped tables)
- **Realtime**: Server-Sent Events from the web app itself (`/api/chat/stream`) — chat + notifications
- **Payments**: Stripe (subscriptions + one-time course sales)
- **Deploy**: Dokploy — each client gets its own container, all share the same MySQL DB

## Workspace Structure
```
apps/
  web/          — Next.js full-stack app
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
pnpm dev              # Start the dev server
pnpm typecheck        # TypeScript check all packages
pnpm lint             # ESLint all packages
pnpm test             # Vitest authz suite (apps/web/src/**/__tests__, Prisma is mocked)
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
- In practice every query filters `tenantId` explicitly; use the guards in
  `src/lib/guards.ts` (`requireMember` / `requireAdminAction` / `requireOwnerAction`,
  `assertTenantUserGroups`, `requireAccessibleChapter`, …) in server actions —
  a session alone is never enough, the user needs a Membership in this tenant.
- Update/delete by id always uses `{ id, tenantId }` (or verifies the parent chain).
- One Better-Auth `User` per email (global identity), but **per-tenant data**:
  `UserProfile` (incl. terms acceptance) and `NotificationPreference` are keyed by
  `[userId, tenantId]` (`src/lib/profile.ts`), presence is `Membership.lastSeenAt`.
- Tenant plan/status are changed only by the Controlcenter internal API; the app's
  Stripe webhook handles Connect course sales only.
- **Uploaded files**: stored under `STORAGE_PATH` (`./uploads` relative to cwd by
  default; `src/lib/storage.ts`). The container filesystem is ephemeral — in
  Dokploy use a **Bind Mount** (host path, e.g. `/srv/coledia/<tenant>/uploads` →
  `/data/uploads`) and set `STORAGE_PATH=/data/uploads`. Do NOT use a named
  "Volume Mount": Dokploy/Docker cleanups (`docker volume prune --all`) delete
  named volumes not attached to a running container, e.g. mid-redeploy.
  Migrating an existing volume once:
  `docker run --rm -v <volume>:/from -v /srv/coledia/<tenant>/uploads:/to alpine cp -a /from/. /to/`.
  Back up the host directory nightly (restic/rsync, e.g. to a Storage Box).
  Diagnostics (`src/lib/storage-health.ts`): `GET /api/health` (public, 503 in
  production when storage is not on a mount / not writable — use as Dokploy
  healthcheck with rollback), `GET /api/storage/health` (admin; lists DB
  references whose files are missing), a status card in Admin → Settings, and a
  boot-time sentinel `.coledia-storage.json` (`src/instrumentation.ts`) that logs
  a CRITICAL error when the storage directory was reset.
- Use `pnpm db:generate` / `pnpm db:migrate` (not `npx prisma …` from the root).
- **Email verification** is per tenant (`Tenant.requireEmailVerification`, default
  false = straight into the app; Admin → Settings → Sign-up & Verification).
  better-auth always signs users in (`requireEmailVerification: false`,
  `sendOnSignUp: false`); the app gates unverified non-admin members in
  `AppShell` (→ `/verify-email?pending=1`) and `requireMember()` (`src/lib/verification.ts`).
  The sign-up mail is sent in the background from `user.create.after` — never
  await SMTP inside an auth request (SMTP has 10–20s timeouts in `src/lib/email.ts`).
- **Navigation / modules** (`src/lib/navigation.ts`, `navigation-config.ts`):
  Admin → Settings → Navigation orders the user sidebar and enables/disables
  modules (`courses`, `dashboard` (can't be disabled), `news`, `events`, `chat`,
  `documents`) and published custom pages (auto-added). Stored in
  `NavigationItem`; missing rows fall back to defaults. Disabled = hidden AND
  blocked for members (admins keep access): module `layout.tsx` → `ModuleGate`,
  `requireModule()` in member actions/guards (`requireAccessibleChapter`,
  `requireVisiblePost`, `requireVisibleEvent`, `requireRoomAccess`),
  `routeMember({ module })` in route handlers, `isModuleEnabled()` in v1 API +
  search. New member-facing features must call one of these.
- Route handlers: use `routeMember()` from `src/lib/guards.ts` (membership +
  verification gate + optional module check) instead of hand-rolled session checks.
- **Devices**: `src/lib/device.ts` parses user agents; `PlatformProvider` /
  `usePlatform()` / `<Shortcut keyName="k" />` give platform-aware shortcuts
  (⌘ on Apple, Ctrl elsewhere), seeded from the session's user agent. Active
  sessions are listed in profile settings (`src/lib/device-actions.ts`).

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

## Chat
- Text channels (ChatServer → Channel, visibility via server + channel user groups;
  tenant admins see all) and 1:1 DMs (`DirectConversation`, ordered user pair).
- Writes go through server actions in `src/lib/chat-message-actions.ts`; access rules
  live in `src/lib/chat/access.ts` (rooms are `channel:<id>` / `dm:<id>`).
  `Message.tenantId` is always set; deletes are soft (`deletedAt`, content cleared);
  only authors edit, authors or admins delete. `ChatReadState` stores each user's
  read position (unread counts, DM ✓✓, channel "seen by").
- Live delivery: `src/lib/chat/bus.ts` (in-process EventEmitter) → SSE stream
  `GET /api/chat/stream`; the browser shares one EventSource
  (`src/lib/chat/stream-client.ts`) for chat and the notification bell. This
  assumes ONE Node process per tenant container — running several replicas of a
  tenant would need Redis pub/sub instead.
- Attachments: `POST /api/chat/attachments` → `{tenantId}/chat/…` (path embeds the
  uploader id); served only via `GET /api/chat/attachments/[messageId]/[index]` with
  room access checks (`/api/uploads` refuses the `chat` segment).
