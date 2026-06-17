import { defineEnvKeys } from './env-key.definition.js';

export const httpEnvKeys = defineEnvKeys([
  {
    key: 'HTTP_TRUST_PROXY',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Express trust proxy toggle for nginx/LB deployments.',
  },
  {
    key: 'HTTP_CORS_ALLOWED_ORIGINS',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Comma-separated explicit CORS origin allowlist.',
  },
  {
    key: 'HTTP_COOKIE_SECURE',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Secure cookie default for production HTTP boundary.',
  },
  {
    key: 'HTTP_COOKIE_SAME_SITE',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'SameSite cookie default for production HTTP boundary.',
  },
  {
    key: 'HTTP_COOKIE_DOMAIN',
    owner: 'http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Optional cookie domain for production API domain.',
  },
] as const);
