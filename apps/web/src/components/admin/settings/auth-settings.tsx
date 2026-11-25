"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, LogIn, MailCheck } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { cn } from "@coledia/ui/lib/utils";
import { updateAuthSettings } from "@/lib/admin-actions";

/** Settings → Sign-up & Verification. */
export function AuthSettings({
  requireEmailVerification,
  smtpConfigured,
}: {
  requireEmailVerification: boolean;
  smtpConfigured: boolean;
}) {
  const t = useTranslations("authSettings");
  const [saved, setSaved] = useState(requireEmailVerification);
  const [value, setValue] = useState(requireEmailVerification);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await updateAuthSettings({ requireEmailVerification: value });
      setSaved(value);
      setMsg(t("saved"));
    } catch {
      setMsg(t("saveError"));
    }
    setSaving(false);
  }

  const options = [
    { value: false, icon: LogIn, label: t("directLabel"), hint: t("directHint") },
    { value: true, icon: MailCheck, label: t("verifyLabel"), hint: t("verifyHint") },
  ];

  return (
    <section className="max-w-3xl rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{t("description")}</p>

      <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setValue(o.value);
                setMsg(null);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-4 text-left transition",
                active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <o.icon className="h-4 w-4" />
                {o.label}
              </span>
              <span className="text-xs text-muted-foreground">{o.hint}</span>
            </button>
          );
        })}
      </div>

      {value && !smtpConfigured && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("smtpMissing")}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("adminsExempt")}</p>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={saving || value === saved} onClick={handleSave}>
          {saving ? t("saving") : t("save")}
        </Button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </section>
  );
}
