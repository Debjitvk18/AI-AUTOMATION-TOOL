import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "fluent-ffmpeg"],
};

export default nextConfig;
