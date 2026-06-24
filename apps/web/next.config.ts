import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  typedRoutes: true,
  output: 'standalone',
  experimental: {
    webVitalsAttribution: ['CLS', 'INP', 'LCP'],
  },
};

export default nextConfig;
