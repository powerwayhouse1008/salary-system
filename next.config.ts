import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
     },
  async redirects() {
    return [
      {
        source: "/admin/salary",
        destination: "/admin/salaries",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
