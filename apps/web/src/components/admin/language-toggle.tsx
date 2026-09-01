"use client";

import { useTranslations } from "next-intl";
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
}: {
  activeLanguage: Locale;
  onLanguageChange: (lang: Locale) => void;
  translatedLanguages?: Set<string>;
  className?: string;
}) {
  const t = useTranslations("languageToggle");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--foreground)]">
          {t("language")}
        </label>
        <span className="text-xs text-[var(--muted-foreground)]">
          {t("translateContent")}
        </span>
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
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 font-medium"
                  : "border-[var(--border)] hover:bg-[var(--muted)]",
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
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("notTranslated")}
        </p>
      )}
    </div>
  );
}
