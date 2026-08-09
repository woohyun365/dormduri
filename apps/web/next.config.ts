import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import { resolveSentryBuildConfig } from './src/observability/sentry/build-config';

function buildSentryCsp(): string | undefined {
  if (
    process.env.NEXT_PUBLIC_SENTRY_ENABLED !== '1' ||
    process.env.NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED !== '1' ||
    !process.env.NEXT_PUBLIC_WEB_RELEASE ||
    process.env.NEXT_PUBLIC_WEB_RELEASE === 'development'
  ) {
    return undefined;
  }
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'https:') return undefined;
    return `connect-src 'self' ${url.origin}`;
  } catch {
    return undefined;
  }
}

const sentryBuild = resolveSentryBuildConfig();

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  typedRoutes: true,
  output: 'standalone',
  productionBrowserSourceMaps: sentryBuild.uploadEnabled,
  typescript: {
    tsconfigPath: 'tsconfig.product.json',
  },
  experimental: {
    webVitalsAttribution: ['CLS', 'INP', 'LCP'],
  },
  async headers() {
    const sentryCsp = buildSentryCsp();
    if (!sentryCsp) return [];
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: sentryCsp }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, sentryBuild.options);
