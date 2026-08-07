import type { NextConfig } from 'next';

function buildOperationalTelemetryCsp(): string | undefined {
  if (process.env.NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED !== '1') return undefined;
  const endpoint = process.env.NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT;
  if (!endpoint) return undefined;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return undefined;
    return `connect-src 'self' ${url.origin}`;
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  typedRoutes: true,
  output: 'standalone',
  productionBrowserSourceMaps: process.env.WEB_BROWSER_SOURCE_MAPS_ENABLED === '1',
  typescript: {
    tsconfigPath: 'tsconfig.product.json',
  },
  experimental: {
    webVitalsAttribution: ['CLS', 'INP', 'LCP'],
  },
  async headers() {
    const telemetryCsp = buildOperationalTelemetryCsp();
    if (!telemetryCsp) return [];
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: telemetryCsp }],
      },
    ];
  },
};

export default nextConfig;
