import { getStorageStatus } from "@/lib/storage-health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — unauthenticated liveness/readiness probe for Dokploy /
 * Docker Swarm healthchecks. Returns 503 in production when the upload
 * storage is not on a mounted volume or not writable (a misconfigured deploy
 * would silently lose uploads) — with "rollback on failure" configured the
 * deploy is rolled back. Missing individual files are reported via the
 * admin-only /api/storage/health instead, so the app stays up.
 */
export async function GET() {
  const status = await getStorageStatus();
  const production = process.env.NODE_ENV === "production";
  const ok = status.writable && (!production || status.persistent !== false);
  return Response.json(
    { ok, storage: { persistent: status.persistent, writable: status.writable } },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
