import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Coledia — Sign In",
  description: "Sign in to your Coledia community platform",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.variable} dark min-h-screen`}>
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] p-4">
        {/* Coledia logo / wordmark */}
        <a
          href="/"
          className="mb-8 flex items-center gap-2 text-2xl font-bold tracking-tight"
        >
          <span className="text-brand-gradient">Coledia</span>
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
            className="font-medium text-[var(--tenant-primary)]"
          >
            Coledia
          </a>
        </p>
      </div>
    </div>
  );
}
