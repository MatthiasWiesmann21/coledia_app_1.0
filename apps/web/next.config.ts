import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  output: "standalone",
  transpilePackages: ["@coledia/ui", "@coledia/db", "@coledia/shared"],
  experimental: {
    // Allow importing from workspace packages
    externalDir: true,
    // Bound build memory: default is (cores - 1) workers each holding the full
    // module graph — that OOMs small build containers (exit 137).
    // memoryBasedWorkersCount caps workers by free RAM instead; cpus is the
    // hard ceiling.
    memoryBasedWorkersCount: true,
    cpus: 4,
  },
  typescript: {
    // TypeScript is already checked by turbo's `typecheck` task (CI). Skip
    // Next.js's inline tsc during `next build` — it's a single process that
    // OOMs small build containers.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default withNextIntl(config);
