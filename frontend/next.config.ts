import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://65.108.246.252:8000/:path*',
      },
    ];
  },
};

export default nextConfig;
