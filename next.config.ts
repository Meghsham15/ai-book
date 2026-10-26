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
};

export default nextConfig;
