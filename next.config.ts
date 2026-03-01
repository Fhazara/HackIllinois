import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  // Avoid loading Sharp on Linux (common cause of Bus error / SIGBUS in production).
  images: { unoptimized: true },
  turbopack: {
    resolveAlias: {
      "@/generated/prisma/client": "./generated/prisma/client.ts",
    },
  },
};

export default nextConfig;
