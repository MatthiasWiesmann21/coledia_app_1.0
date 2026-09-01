import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@coledia/ui", "@coledia/db", "@coledia/shared"],
  experimental: {
    // Allow importing from workspace packages
    externalDir: true,
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

export default config;
