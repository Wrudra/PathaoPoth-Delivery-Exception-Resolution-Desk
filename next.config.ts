import type { NextConfig } from "next";

const devHost = process.env.BLOCKS_DEV_HOST;

const nextConfig: NextConfig = {
  // The dev server already trusts the hostname it was started with (-H); this
  // keeps it working when someone starts plain `next dev` and browses on the
  // project domain anyway.
  allowedDevOrigins: devHost ? [devHost] : undefined,
  // Standalone output makes the Dockerfile small and self-contained.
  output: "standalone",
  reactStrictMode: true
};

export default nextConfig;
