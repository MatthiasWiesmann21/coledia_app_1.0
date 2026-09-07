import { getTenantStorageUsage } from "@/lib/storage-quota";
import { getCurrentPlanLimits } from "@/lib/plan";
import { getTenantId } from "@/lib/tenant";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function StorageUsage() {
  const tenantId = getTenantId();
  const [{ storageLimitBytes, plan }, used] = await Promise.all([
    getCurrentPlanLimits(),
    getTenantStorageUsage(tenantId),
  ]);

  const limit = storageLimitBytes;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const unlimited = limit === null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Storage usage</h2>
        <span className="text-xs text-muted-foreground">
          {plan} plan · {unlimited ? "Unlimited" : formatBytes(limit!)}
        </span>
      </div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{formatBytes(used)}</span>
        <span className="text-muted-foreground">
          {unlimited ? "no limit" : `${pct}% used`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 90 ? "bg-destructive" : pct > 75 ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: unlimited ? "8%" : `${pct}%` }}
        />
      </div>
      {pct > 90 && !unlimited && (
        <p className="mt-2 text-xs text-destructive">
          Storage almost full — delete unused files or upgrade your plan.
        </p>
      )}
    </div>
  );
}
