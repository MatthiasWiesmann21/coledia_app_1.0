import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, HardDrive } from "lucide-react";
import { findMissingUploads, getStorageStatus } from "@/lib/storage-health";

/** Settings → General: upload storage persistence status (server component). */
export async function StorageStatusCard({ tenantId }: { tenantId: string }) {
  const t = await getTranslations("storageStatus");
  const [status, report] = await Promise.all([getStorageStatus(), findMissingUploads(tenantId)]);
  const problem = status.persistent === false || !status.writable || report.missing > 0;

  return (
    <section
      className={`max-w-3xl rounded-xl border p-6 ${
        problem ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
      }`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <HardDrive className="h-5 w-5" />
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        <StatusRow
          ok={status.persistent !== false}
          label={
            status.persistent === null
              ? t("mountUnknown")
              : status.persistent
                ? t("mountOk", { path: status.mountPoint ?? "" })
                : t("mountMissing")
          }
        />
        <StatusRow ok={status.writable} label={status.writable ? t("writable") : t("notWritable")} />
        <StatusRow
          ok={report.missing === 0}
          label={
            report.missing === 0
              ? t("allFilesPresent", { count: report.checked })
              : t("filesMissing", { missing: report.missing, count: report.checked })
          }
        />
      </ul>
      {report.missing > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {Object.entries(report.byCategory)
            .filter(([, c]) => c.missing > 0)
            .map(([cat, c]) => (
              <li key={cat} className="rounded-full border border-border px-2 py-0.5">
                {cat}: {c.missing}/{c.checked}
              </li>
            ))}
        </ul>
      )}
      {problem && <p className="mt-3 text-xs text-muted-foreground">{t("hint")}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        <code>{status.storageBase}</code>
      </p>
    </section>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
      )}
      {label}
    </li>
  );
}
