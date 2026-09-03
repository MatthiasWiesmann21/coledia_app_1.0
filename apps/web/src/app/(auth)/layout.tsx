import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "../globals.css";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { ThemeToggle } from "@/components/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Coledia — Sign In",
  description: "Sign in to your Coledia community platform",
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages(defaultLocale);

  return (
    <NextIntlClientProvider locale={defaultLocale} messages={messages}>
      <div className={`${inter.variable} min-h-screen`}>
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--background)] p-4">
          {/* Theme toggle — top-right corner */}
          <div className="absolute right-4 top-4">
            <ThemeToggle />
          </div>

          {/* Custom logo placeholder */}
          {/* In production this will be replaced with the tenant's custom logo
              via TenantBranding (authLogoSignInLight / authLogoSignInDark). */}
          <a
            href="/"
            className="mb-8 flex items-center justify-center"
            aria-label="Home"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]">
              <span className="text-2xl font-bold text-brand-gradient">C</span>
            </div>
          </a>

          {/* Auth card */}
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-lg">
            {children}
          </div>

          {/* Footer */}
          <p className="mt-8 text-sm text-[var(--muted-foreground)]">
            Made by{" "}
            <a
              href="https://coledia.com"
              className="font-medium text-[var(--tenant-primary)] hover:underline"
            >
              Coledia
            </a>
          </p>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
