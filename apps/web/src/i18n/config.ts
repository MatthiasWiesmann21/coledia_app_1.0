export const locales = ["en", "de", "fr", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

// Text codes — flag emojis don't render on Windows (they show as "GB"/"DE").
export const localeCodes: Record<Locale, string> = {
  en: "EN",
  de: "DE",
  fr: "FR",
  es: "ES",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
