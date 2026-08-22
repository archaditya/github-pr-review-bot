/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces .next/standalone — a self-contained server bundle, so the prod Dockerfile
  // doesn't need to ship node_modules or run `next start` against the full project (ADR-008).
  output: 'standalone',
};

export default nextConfig;
