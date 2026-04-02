const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_API_UPSTREAM_URL = 'http://localhost:4000';
const DEFAULT_PUBLIC_API_BASE = '/api';

export const webEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL,
  apiUpstreamUrl: process.env.API_URL ?? DEFAULT_API_UPSTREAM_URL,
  publicApiBase: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_PUBLIC_API_BASE,
} as const;

export const webEnvDefaults = {
  appUrl: DEFAULT_APP_URL,
  apiUpstreamUrl: DEFAULT_API_UPSTREAM_URL,
  publicApiBase: DEFAULT_PUBLIC_API_BASE,
} as const;
