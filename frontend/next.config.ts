import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  reactStrictMode: true,
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', '@google-cloud/storage'],
};

export default nextConfig;
