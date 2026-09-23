
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Vercel uses the root path.
// GitHub Pages uses /sunny in production.
const basePath = isVercel
  ? ''
  : (process.env.NEXT_PUBLIC_BASE_PATH ?? (isProd ? '/sunny' : ''));

const nextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  reactStrictMode: false, // Prevents double-mounting camera scanner in dev
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
