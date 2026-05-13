/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module; mark it external for the server build
  serverExternalPackages: ["better-sqlite3", "ws"],
  experimental: {
    // Allow imports from data/seed/* used by API routes
  },
};

module.exports = nextConfig;
