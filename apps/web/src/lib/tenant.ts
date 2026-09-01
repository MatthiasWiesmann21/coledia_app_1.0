import { RESERVED_SUBDOMAINS } from "@coledia/shared";

/**
 * Tenant resolution by hostname.
 *
 * - `coledia.com` / `www.coledia.com` → marketing site (null)
 * - `acme.coledia.com` → tenant with subdomain `acme`
 * - `www.club.ch` → tenant with custom domain `www.club.ch` (or `club.ch`)
 *
 * In development, we use `.localhost` instead of `.coledia.com`.
 */

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "coledia.com";
const LOCALHOST = "localhost";

export interface ResolvedTenant {
  type: "subdomain" | "custom-domain";
  identifier: string; // subdomain or full custom domain
}

export function resolveTenantFromHost(host: string): ResolvedTenant | null {
  // Normalize: remove port, lowercase
  const hostname = host.split(":")[0].toLowerCase().trim();

  // Marketing site — no tenant
  if (
    hostname === APP_DOMAIN ||
    hostname === `www.${APP_DOMAIN}` ||
    hostname === LOCALHOST ||
    hostname === `www.${LOCALHOST}`
  ) {
    return null;
  }

  // Subdomain pattern: `<sub>.coledia.com` or `<sub>.localhost`
  const subdomainSuffixes = [`.${APP_DOMAIN}`, `.${LOCALHOST}`];

  for (const suffix of subdomainSuffixes) {
    if (hostname.endsWith(suffix)) {
      const subdomain = hostname.slice(0, -suffix.length);

      // Skip `www` — it's handled above as marketing
      if (subdomain === "www") return null;
      if (RESERVED_SUBDOMAINS.includes(subdomain)) return null;

      return { type: "subdomain", identifier: subdomain };
    }
  }

  // Custom domain — return the full hostname for DB lookup
  return { type: "custom-domain", identifier: hostname };
}

/**
 * Extracts the tenant identifier for database lookup.
 * Used by middleware and server components.
 */
export function getTenantIdentifierFromRequest(request: Request): ResolvedTenant | null {
  const host = request.headers.get("host") ?? "";
  return resolveTenantFromHost(host);
}
