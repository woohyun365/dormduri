import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  typedRoutes: true,
  output: 'standalone',
  typescript: {
    tsconfigPath: 'tsconfig.product.json',
  },
  experimental: {
    webVitalsAttribution: ['CLS', 'INP', 'LCP'],
  },
};

export default nextConfig;
