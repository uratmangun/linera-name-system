import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Rewrite /llms.txt and /docs.md to /llms-txt (Next.js doesn't support dots in folder names)
  async rewrites() {
    return [
      {
        source: "/llms.txt",
        destination: "/llms-txt",
      },
      {
        source: "/docs.md",
        destination: "/llms-txt",
      },
    ];
  },
  // Required for SharedArrayBuffer support (Linera WASM)
  // Exclude /llms.txt and /docs.md from COOP/COEP headers for LLM crawler compatibility
  async headers() {
    return [
      {
        // Apply strict headers to all routes except LLM endpoints
        source: "/((?!llms-txt|llms\\.txt|docs\\.md).*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
    ];
  },
  // Exclude packages from server-side bundling - they're browser-only
  serverExternalPackages: [
    "@linera/client",
    "pino",
    "thread-stream",
    "pino-pretty",
    "@walletconnect/universal-provider",
    "@walletconnect/ethereum-provider",
  ],
  // Empty turbopack config to acknowledge we're using turbopack
  turbopack: {},
};

export default nextConfig;
