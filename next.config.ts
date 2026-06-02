import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Keep module resolution anchored to this app when `.next` is on another path.
    root: projectRoot,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Reuse fetch() results across HMR in Server Components (local dev only).
    serverComponentsHmrCache: true,
  },
};

export default nextConfig;
