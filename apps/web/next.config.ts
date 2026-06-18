import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  output: 'standalone',
  experimental: {
    webVitalsAttribution: ['CLS', 'INP', 'LCP'],
  },
};

export default nextConfig;
