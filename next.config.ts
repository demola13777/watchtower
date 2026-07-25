import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure native/binary packages run in Node.js runtime (not Edge/bundled)
  serverExternalPackages: [
    "@modelcontextprotocol/sdk",
    "better-sqlite3",
    "@libsql/client",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, HEAD, OPTIONS, DELETE" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-PAYMENT, PAYMENT-SIGNATURE" },
          { key: "Access-Control-Expose-Headers", value: "PAYMENT-REQUIRED, PAYMENT-RESPONSE" },
        ],
      },
    ];
  },
};

export default nextConfig;
