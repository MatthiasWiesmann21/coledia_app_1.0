import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@coledia/db";
import { schemas, RESERVED_SUBDOMAINS, PLANS } from "@coledia/shared";
import { requireInternalSecret } from "@/lib/internal-auth";

/**
 * Internal API — create a tenant for a Controlcenter container.
 *
 * Called by the Coledia Controlcenter after a successful payment. Creates the
 * Tenant (+ Branding + owner User/Membership) in this shared DB and returns the
 * tenant id, which the Controlcenter operator wires into the Dokploy container
 * as TENANT_ID.
 *
 * Idempotent: the same `provisionId` (or `tenantId`) returns the existing tenant.
 *
 * Auth: Bearer token must match INTERNAL_API_SECRET (see lib/internal-auth.ts).
 */

export const runtime = "nodejs";

const createTenantPayload = z.object({
  provisionId: z.string().min(1),
  tenantId: z
    .string()
    .uuid("tenantId must be a UUID"),
  name: z.string().min(2).max(100),
  description: z.string().max(500).nullish(),
  subdomain: schemas.tenantSubdomainSchema,
  plan: z.enum([PLANS.STARTER, PLANS.CLUB, PLANS.ORGANIZATION]).default(PLANS.STARTER),
  themePreset: z.string().max(50).nullish(),
  themeMode: z.enum(["light", "dark", "system"]).nullish(),
  ownerEmail: z.string().email(),
  ownerName: z.string().max(100).nullish(),
  // Optional custom-owner fields from the Controlcenter onboarding wizard.
  // ownerPasswordHash is a better-auth scrypt hash (never plaintext) — the
  // Controlcenter hashes with the same algorithm so the account works on
  // this app's auth instance.
  ownerUsername: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).nullish(),
  ownerPasswordHash: z.string().min(10).nullish(),
});

export async function POST(req: NextRequest) {
  const authError = requireInternalSecret(req);
  if (authError) return authError;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTenantPayload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (RESERVED_SUBDOMAINS.includes(data.subdomain)) {
    return NextResponse.json({ error: "Subdomain is reserved" }, { status: 409 });
  }

  // Idempotency: same provisionId or tenantId → return the existing tenant.
  const existing = await prisma.tenant.findFirst({
    where: {
      OR: [{ externalRef: data.provisionId }, { id: data.tenantId }],
    },
    select: { id: true, subdomain: true },
  });
  if (existing) {
    return NextResponse.json({ tenantId: existing.id, alreadyExisted: true });
  }

  const subdomainTaken = await prisma.tenant.findUnique({
    where: { subdomain: data.subdomain },
    select: { id: true },
  });
  if (subdomainTaken) {
    return NextResponse.json({ error: "Subdomain is already taken" }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        id: data.tenantId, // explicit UUID chosen by the Controlcenter
        name: data.name,
        subdomain: data.subdomain,
        plan: data.plan,
        status: "active",
        externalRef: data.provisionId,
      },
    });

    await tx.branding.create({
      data: {
        tenantId: tenant.id,
        themePreset: data.themePreset ?? "coledia",
        themeMode: data.themeMode ?? null,
      },
    });

    // Owner account: created UNVERIFIED — the owner verifies their email on
    // the app itself (the Controlcenter triggers /api/auth/send-verification-
    // email on the new container once it's live). If a better-auth password
    // hash was supplied, the credential account is created with it so the
    // owner can sign in right after verifying; otherwise they set a password
    // via the app's forgot-password flow.
    const owner = await tx.user.upsert({
      where: { email: data.ownerEmail.toLowerCase() },
      update: {},
      create: {
        email: data.ownerEmail.toLowerCase(),
        emailVerified: false,
        name: data.ownerName ?? null,
      },
    });

    if (data.ownerUsername) {
      await tx.userProfile.upsert({
        where: { userId: owner.id },
        update: { username: data.ownerUsername },
        create: { userId: owner.id, username: data.ownerUsername },
      });
    }

    if (data.ownerPasswordHash) {
      const credentialAccount = await tx.account.findFirst({
        where: { userId: owner.id, providerId: "credential" },
      });
      if (credentialAccount) {
        await tx.account.update({
          where: { id: credentialAccount.id },
          data: { password: data.ownerPasswordHash },
        });
      } else {
        await tx.account.create({
          data: {
            accountId: owner.id,
            providerId: "credential",
            userId: owner.id,
            password: data.ownerPasswordHash,
          },
        });
      }
    }

    await tx.membership.upsert({
      where: {
        userId_tenantId: { userId: owner.id, tenantId: tenant.id },
      },
      update: { role: "owner" },
      create: { userId: owner.id, tenantId: tenant.id, role: "owner" },
    });

    return tenant;
  });

  return NextResponse.json({ tenantId: result.id }, { status: 201 });
}
