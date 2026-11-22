import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './src/security/content-security-policy';

const nextConfig: NextConfig = {
  // Agent instructions live in the repository root AGENTS.md; keep `next dev` from writing one here.
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] }];
  },
};

export default nextConfig;
