/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mounting camera scanner in dev
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
