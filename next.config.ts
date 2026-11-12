import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build (NEXT_DIST_DIR=.next-verify) run without touching the dev server's .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
