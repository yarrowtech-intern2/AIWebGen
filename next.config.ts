import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Native / subprocess-spawning packages must not be bundled.
  serverExternalPackages: [
    "@anthropic-ai/claude-agent-sdk",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "esbuild",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
