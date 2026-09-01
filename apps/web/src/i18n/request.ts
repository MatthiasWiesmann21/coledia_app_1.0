import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";
import { getMessages } from "./get-messages";
import { getUserLocale } from "./get-locale";

export default getRequestConfig(async () => {
  // Read locale from user profile (falls back to defaultLocale)
  let locale: Locale = defaultLocale;
  try {
    locale = await getUserLocale();
  } catch {
    // Use default
  }

  if (!isLocale(locale)) {
    locale = defaultLocale;
  }

  const messages = await getMessages(locale);

  return {
    locale,
    messages,
  };
});
