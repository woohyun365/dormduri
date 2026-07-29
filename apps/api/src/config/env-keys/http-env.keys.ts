import { defineEnvKeys } from './env-key.definition.js';

export const httpEnvKeys = defineEnvKeys([
  {
    key: 'HTTP_TRUST_PROXY_HOPS',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Exact number of trusted reverse-proxy hops. Zero keeps direct API trust off.',
  },
  {
    key: 'HTTP_TRUST_PROXY_CIDRS',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Explicit trusted reverse-proxy IP/CIDR or Express subnet preset allowlist.',
  },
  {
    key: 'HTTP_CORS_ALLOWED_ORIGINS',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Comma-separated explicit REST CORS origin allowlist. Wildcard is rejected.',
  },
  {
    key: 'HTTP_COOKIE_SECURE',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Secure cookie default for future production HTTP cookie surfaces.',
  },
  {
    key: 'HTTP_COOKIE_SAME_SITE',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'SameSite cookie default for future production HTTP cookie surfaces.',
  },
  {
    key: 'HTTP_COOKIE_DOMAIN',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Optional cookie domain for future production API cookie surfaces.',
  },
] as const);
