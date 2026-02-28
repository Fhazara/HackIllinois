import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  turbopack: {
    resolveAlias: {
      "@/generated/prisma/client": "./generated/prisma/client.ts",
    },
  },
};

export default nextConfig;
