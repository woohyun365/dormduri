import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './src/security/content-security-policy';

const nextConfig: NextConfig = {
  // Agent instructions live in the repository root AGENTS.md; keep `next dev` from writing one here.
  agentRules: false,
  // The production image (infra/deploy/backoffice-web/Dockerfile) runs the standalone server of this build. The e2e
  // serves the same build with `next start`, which only warns about standalone output.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] }];
  },
};

export default nextConfig;
