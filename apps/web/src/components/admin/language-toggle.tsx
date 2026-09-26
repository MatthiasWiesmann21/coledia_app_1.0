"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { cn } from "@coledia/ui/lib/utils";

/**
 * Language toggle for admin editors.
 * Shows flags for each language. The active language is highlighted.
 * Languages with existing translations show a dot indicator.
 */
export function LanguageToggle({
  activeLanguage,
  onLanguageChange,
  translatedLanguages,
  className,
  onFillLanguages,
}: {
  activeLanguage: Locale;
  onLanguageChange: (lang: Locale) => void;
  translatedLanguages?: Set<string>;
  className?: string;
  /**
   * Optional "copy current content to all empty languages" handler.
   * Receives nothing; the editor decides which fields to fill.
   */
  onFillLanguages?: () => Promise<number | void> | void;
}) {
  const t = useTranslations("languageToggle");
  const [filling, setFilling] = useState(false);
  const [fillMsg, setFillMsg] = useState<string | null>(null);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {t("language")}
        </label>
        <div className="flex items-center gap-3">
          {onFillLanguages && (
            <button
              type="button"
              disabled={filling}
              onClick={async () => {
                setFilling(true);
                setFillMsg(null);
                try {
                  const filled = await onFillLanguages();
                  setFillMsg(
                    typeof filled === "number" && filled > 0
                      ? t("fillDone", { count: filled })
                      : t("fillNone"),
                  );
                } catch {
                  setFillMsg(t("fillFailed"));
                }
                setFilling(false);
              }}
              className="flex items-center gap-1 text-xs text-primary transition hover:underline disabled:opacity-50"
            >
              <Languages className="h-3.5 w-3.5" />
              {filling ? t("filling") : t("fillEmpty")}
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {t("translateContent")}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {locales.map((loc) => {
          const isActive = activeLanguage === loc;
          const hasTranslation = translatedLanguages?.has(loc) ?? false;
          return (
            <button
              key={loc}
              type="button"
              onClick={() => onLanguageChange(loc)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                isActive
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border hover:bg-muted",
              )}
            >
              <span>{localeFlags[loc]}</span>
              {localeNames[loc]}
              {hasTranslation && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
      {!translatedLanguages?.has(activeLanguage) && activeLanguage !== "en" && (
        <p className="text-xs text-muted-foreground">
          {t("notTranslated")}
        </p>
      )}
      {fillMsg && (
        <p className="text-xs text-muted-foreground">{fillMsg}</p>
      )}
    </div>
  );
}
