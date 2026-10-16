import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",
  // External packages for server-side only (native modules)
  serverExternalPackages: ["better-sqlite3"],
  // Goals were replaced by Projects (docs/spikes/goals-to-projects.md)
  redirects: async () => [
    { source: "/goals", destination: "/projects", permanent: false },
    { source: "/goals/:id", destination: "/projects", permanent: false },
  ],
  // Security headers
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
  devIndicators: false
};

export default nextConfig;
