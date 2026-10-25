import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["mongoose", "unpdf", "cheerio", "nodemailer"],
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
