import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/claims/**": ["./assets/fonts/*"] },
};

export default nextConfig;
