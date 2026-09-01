import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Coledia — Connecting Knowledge. Empowering Futures.",
  description:
    "The modern platform for clubs, associations and small teams. Courses, community, live events and documents — fairly priced and easy to love.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
