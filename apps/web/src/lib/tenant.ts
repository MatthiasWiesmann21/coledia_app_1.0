/**
 * Tenant resolution via TENANT_ID environment variable.
 *
 * Each Dokploy container has TENANT_ID set to the tenant's cuid.
 * The app reads this once at startup — no hostname parsing needed.
 *
 * Custom domains are handled by Dokploy's domain mapping, not by the app.
 */

/**
 * Get the current tenant ID from the environment.
 * Throws if not set — the app should fail fast rather than silently
 * operating without tenant context.
 */
export function getTenantId(): string {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    throw new Error(
      "TENANT_ID environment variable is not set. " +
        "Each deployment must have TENANT_ID configured.",
    );
  }
  return tenantId;
}

/**
 * Safe variant that returns null instead of throwing.
 * Useful for marketing/landing pages that don't need a tenant.
 */
export function getTenantIdOrNull(): string | null {
  return process.env.TENANT_ID ?? null;
}
