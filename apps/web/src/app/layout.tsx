import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  let icons: Metadata["icons"] = undefined;

  try {
    const tenantId = getTenantId();
    const branding = await prisma.branding.findUnique({
      where: { tenantId },
      select: { faviconUrl: true },
    });

    if (branding?.faviconUrl) {
      icons = { icon: branding.faviconUrl, shortcut: branding.faviconUrl };
    }
  } catch {
    // Ignore — fall back to no favicon
  }

  return {
    title: "Coledia — Connecting Knowledge. Empowering Futures.",
    description:
      "The modern platform for clubs, associations and small teams. Courses, community, live events and documents — fairly priced and easy to love.",
    icons,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
