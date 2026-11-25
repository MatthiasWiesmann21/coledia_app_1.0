/**
 * Next.js boot hook — runs once per server process.
 * Verifies upload storage persistence (see lib/storage-health.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) return;
  try {
    const { checkStorageSentinel, getStorageStatus } = await import("./lib/storage-health");
    const status = await getStorageStatus();
    if (process.env.NODE_ENV === "production" && status.persistent === false) {
      console.error(
        `[storage] STORAGE_PATH (${status.storageBase}) is not on a mounted volume — uploads WILL BE LOST on redeploy.`,
      );
    }
    await checkStorageSentinel(tenantId);
  } catch (err) {
    console.error("[storage] Boot storage check failed:", err);
  }
}
