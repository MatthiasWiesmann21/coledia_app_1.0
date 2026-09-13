# ─── Stage 1: Install dependencies ─────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

# Copy only workspace manifests for deterministic install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/realtime/package.json apps/realtime/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma/schema.prisma packages/db/prisma/
COPY packages/ui/package.json packages/ui/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

# Bring installed node_modules from deps
COPY --from=deps /app ./

# Copy the full source
COPY . .

# Generate Prisma client (needs a DATABASE_URL for prisma.config.ts to load,
# but generate does not connect to the database)
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
RUN pnpm --filter @coledia/db run generate

# Build only the web app (turbo resolves workspace dependencies)
RUN pnpm --filter @coledia/web run build

# ─── Stage 3: Production runner ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Runtime env vars are injected by Dokploy:
#   TENANT_ID, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
#   NEXT_PUBLIC_APP_URL, STORAGE_PATH, REALTIME_URL, STRIPE_*, SMTP_*

# Next.js standalone output — self-contained server with traced deps
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Persistent upload storage (mount a volume here in production)
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
