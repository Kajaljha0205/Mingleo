import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: let phones on the LAN load dev assets, e.g. DEV_ORIGINS=192.168.1.6
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
  experimental: {
    // Photos are resized/compressed client-side to stay under Vercel's 4.5 MB function payload limit.
    serverActions: { bodySizeLimit: "4mb" },
    proxyClientMaxBodySize: "4mb",
  },
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
