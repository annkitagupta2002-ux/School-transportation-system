import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiOrigin = process.env.API_ORIGIN || "http://localhost:4001";
const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const turbopackRoot = path.resolve(process.cwd()) === frontendRoot ? frontendRoot : path.dirname(frontendRoot);

const nextConfig: NextConfig = {
  async rewrites() {
    return { beforeFiles: [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }] };
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: turbopackRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
