import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // A 4.5 MB file plus the form wrapper can sit a little above 4.5 MB.
    proxyClientMaxBodySize: "5mb",
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["mongoose", "unpdf", "cheerio", "nodemailer", "@napi-rs/canvas"],
};

export default nextConfig;
