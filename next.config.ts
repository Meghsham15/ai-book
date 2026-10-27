import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // A 50 MB file plus the form wrapper can sit a little above 50 MB.
    proxyClientMaxBodySize: "60mb",
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["mongoose", "unpdf", "cheerio", "nodemailer"],
};

export default nextConfig;
