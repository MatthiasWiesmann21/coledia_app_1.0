"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  forcedTheme,
}: {
  children: ReactNode;
  defaultTheme?: string;
  /** When set, next-themes forces this theme and ignores user selection. */
  forcedTheme?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      forcedTheme={forcedTheme}
      enableSystem={!forcedTheme || forcedTheme === "system"}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
