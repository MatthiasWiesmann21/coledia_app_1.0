import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@coledia/db";
import { schemas, RESERVED_SUBDOMAINS, PLANS, TENANT_STATUS } from "@coledia/shared";
import { requireInternalSecret } from "@/lib/internal-auth";

/**
 * Internal API — update a tenant (called by the Coledia Controlcenter).
 *
 * Used for plan changes, suspension/reactivation and branding/name sync.
 * Auth: Bearer token must match INTERNAL_API_SECRET.
 */

export const runtime = "nodejs";

const updateTenantPayload = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullish(),
  subdomain: schemas.tenantSubdomainSchema.optional(),
  plan: z.enum([PLANS.STARTER, PLANS.CLUB, PLANS.ORGANIZATION]).optional(),
  tenantStatus: z
    .enum([TENANT_STATUS.ACTIVE, TENANT_STATUS.SUSPENDED])
    .optional(),
  themePreset: z.string().max(50).nullish(),
  themeMode: z.enum(["light", "dark", "system"]).nullish(),
});

/**
 * Read-back for the Controlcenter health check: returns the tenant plus its
 * branding so the Controlcenter can verify that seeded settings (theme,
 * plan, subdomain, …) actually landed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireInternalSecret(req);
  if (authError) return authError;

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subdomain: true,
      plan: true,
      status: true,
      branding: {
        select: { themePreset: true, themeMode: true },
      },
    },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, tenant });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireInternalSecret(req);
  if (authError) return authError;

  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTenantPayload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, subdomain: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (data.subdomain && data.subdomain !== tenant.subdomain) {
    if (RESERVED_SUBDOMAINS.includes(data.subdomain)) {
      return NextResponse.json({ error: "Subdomain is reserved" }, { status: 409 });
    }
    const taken = await prisma.tenant.findUnique({
      where: { subdomain: data.subdomain },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Subdomain is already taken" }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.subdomain !== undefined ? { subdomain: data.subdomain } : {}),
        ...(data.plan !== undefined ? { plan: data.plan } : {}),
        ...(data.tenantStatus !== undefined ? { status: data.tenantStatus } : {}),
      },
    });

    const brandingData: { themePreset?: string; themeMode?: string | null } = {};
    if (data.themePreset != null) brandingData.themePreset = data.themePreset;
    if (data.themeMode !== undefined) brandingData.themeMode = data.themeMode;
    if (Object.keys(brandingData).length > 0) {
      await tx.branding.upsert({
        where: { tenantId: id },
        update: brandingData,
        create: { tenantId: id, ...brandingData },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
