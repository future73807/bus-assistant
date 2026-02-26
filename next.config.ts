import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    // 允许所有来源的请求，包括本地 HTTPS 代理
    allowedDevOrigins: ["localhost:3000", "localhost:3001", "127.0.0.1:3000", "127.0.0.1:3001", "0.0.0.0:3000", "0.0.0.0:3001", "192.168.31.115:3001"]
  }
};

export default nextConfig;
