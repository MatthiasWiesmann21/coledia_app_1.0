"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { useConfirm } from "@/components/confirm-provider";
import { revokeDevice, revokeOtherDevices, type DeviceSession } from "@/lib/device-actions";

const ICONS = { desktop: Laptop, mobile: Smartphone, tablet: Tablet } as const;

/** Profile settings → Active devices (one row per signed-in session). */
export function ActiveDevices({ devices }: { devices: DeviceSession[] }) {
  const t = useTranslations("devices");
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const others = devices.filter((d) => !d.current);

  function run(action: () => Promise<void>) {
    setMsg(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch {
        setMsg(t("error"));
      }
    });
  }

  async function handleRevoke(d: DeviceSession) {
    const ok = await confirm({
      title: t("revokeTitle"),
      description: t("revokeDescription", { device: `${d.browser} · ${d.osLabel}` }),
      confirmLabel: t("signOut"),
      destructive: true,
    });
    if (ok) run(() => revokeDevice(d.id));
  }

  async function handleRevokeOthers() {
    const ok = await confirm({
      title: t("revokeOthersTitle"),
      description: t("revokeOthersDescription"),
      confirmLabel: t("signOutOthers"),
      destructive: true,
    });
    if (ok) run(() => revokeOtherDevices());
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {others.length > 0 && (
          <Button variant="outline" size="sm" disabled={pending} onClick={handleRevokeOthers}>
            {t("signOutOthers")}
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {devices.map((d) => {
          const Icon = ICONS[d.deviceType];
          return (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {d.browser} · {d.osLabel}
                  {d.current && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {t("thisDevice")}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("lastActive", { date: new Date(d.lastActiveAt).toLocaleString() })}
                  {d.ipAddress && ` · ${d.ipAddress}`}
                </p>
              </div>
              {!d.current && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => handleRevoke(d)}
                  aria-label={t("signOut")}
                  className="text-red-500 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {msg && <p className="text-sm text-red-500">{msg}</p>}
    </section>
  );
}
