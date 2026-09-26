"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ALL_NOTIFICATION_TYPES, NOTIFICATION_CHANNELS } from "@coledia/shared";
import { setNotificationPreference } from "@/lib/notification-actions";
import { cn } from "@coledia/ui/lib/utils";

type PrefRow = { type: string; channel: string; enabled: boolean };

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition",
        checked ? "bg-primary" : "bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export function NotificationPreferences({
  initialPrefs,
}: {
  initialPrefs: PrefRow[];
}) {
  const t = useTranslations("notifications");
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const p of initialPrefs) map[`${p.type}:${p.channel}`] = p.enabled;
    return map;
  });
  const [pending, startTransition] = useTransition();

  // in_app defaults to enabled; email defaults to disabled (opt-in)
  function isEnabled(type: string, channel: string) {
    const key = `${type}:${channel}`;
    if (key in prefs) return prefs[key];
    return channel === NOTIFICATION_CHANNELS.IN_APP;
  }

  function handleChange(type: string, channel: string, enabled: boolean) {
    const key = `${type}:${channel}`;
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: enabled }));
    startTransition(async () => {
      try {
        await setNotificationPreference(type, channel, enabled);
      } catch {
        // Revert optimistic update so the toggle doesn't lie about state
        setPrefs((p) => {
          const next = { ...p };
          if (prev === undefined) delete next[key];
          else next[key] = prev;
          return next;
        });
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">{t("typeColumn")}</th>
            <th className="w-28 px-4 py-3 text-center font-medium">{t("inApp")}</th>
            <th className="w-28 px-4 py-3 text-center font-medium">{t("email")}</th>
          </tr>
        </thead>
        <tbody>
          {ALL_NOTIFICATION_TYPES.map((type) => (
            <tr key={type} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3">{t(`types.${type}`)}</td>
              {([NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL] as const).map(
                (channel) => (
                  <td key={channel} className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle
                        checked={isEnabled(type, channel)}
                        disabled={pending}
                        onChange={(v) => handleChange(type, channel, v)}
                        label={`${t(`types.${type}`)} — ${channel}`}
                      />
                    </div>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {t("emailNote")}
      </p>
    </div>
  );
}
