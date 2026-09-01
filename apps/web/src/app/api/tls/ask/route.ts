import { NextResponse } from "next/server";
import { prisma } from "@coledia/db";

/**
 * Caddy on-demand TLS verification endpoint.
 *
 * Caddy calls this endpoint before issuing a TLS certificate for a domain.
 * We return 200 if the domain belongs to a tenant, 403 otherwise.
 *
 * Caddy config:
 *   tls {
 *     on_demand_tls {
 *       ask http://web:3000/api/tls/ask
 *     }
 *   }
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  const hostname = domain.toLowerCase().trim();

  // Always allow the main app domain
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "coledia.com";
  if (hostname === appDomain || hostname === `www.${appDomain}`) {
    return new NextResponse(null, { status: 200 });
  }

  // Check if it's a subdomain of the app domain
  if (hostname.endsWith(`.${appDomain}`)) {
    const subdomain = hostname.slice(0, -(`.${appDomain}`.length));
    if (subdomain === "www") {
      return new NextResponse(null, { status: 200 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true },
    });

    return new NextResponse(null, { status: tenant ? 200 : 403 });
  }

  // Check if it's a custom domain
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ customDomain: hostname }, { customDomain: `www.${hostname}` }],
    },
    select: { id: true },
  });

  return new NextResponse(null, { status: tenant ? 200 : 403 });
}
