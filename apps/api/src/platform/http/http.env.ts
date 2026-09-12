import Joi, { type CustomHelpers } from 'joi';
import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import { DEFAULT_HTTP_TRUST_PROXY_HOPS, parseHttpTrustProxyCidrs } from './http.config.js';
import { type EnvSchemaDefinition } from '../../config/environment/joi-helpers.js';

export const httpEnvSchema = {
  HTTP_TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(DEFAULT_HTTP_TRUST_PROXY_HOPS),
  HTTP_TRUST_PROXY_CIDRS: trustProxyCidrsEnv(),
  HTTP_CORS_ALLOWED_ORIGINS: explicitCorsOriginListEnv(),
} satisfies EnvSchemaDefinition;

function trustProxyCidrsEnv() {
  return Joi.string()
    .trim()
    .allow('')
    .optional()
    .custom((value: string, helpers: CustomHelpers) => {
      try {
        parseHttpTrustProxyCidrs(value);
        return value;
      } catch {
        return helpers.error('any.invalid');
      }
    }, 'trusted proxy CIDR list');
}

function explicitCorsOriginListEnv() {
  return Joi.string()
    .trim()
    .allow('')
    .optional()
    .custom((value: string, helpers: CustomHelpers) => {
      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

      for (const origin of origins) {
        if (origin === '*') {
          return helpers.error('any.invalid');
        }

        let parsed: URL;
        try {
          parsed = new URL(origin);
        } catch {
          return helpers.error('any.invalid');
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return helpers.error('any.invalid');
        }

        if (
          parsed.pathname !== '/' ||
          parsed.search ||
          parsed.hash ||
          parsed.username ||
          parsed.password
        ) {
          return helpers.error('any.invalid');
        }
      }

      return value;
    }, 'explicit CORS origin list');
}

export const httpEnvKeys = defineEnvKeys([
  {
    key: 'HTTP_TRUST_PROXY_HOPS',
    owner: 'platform-http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    targetRequired: true,
    description: 'Exact number of trusted reverse-proxy hops. Zero keeps direct API trust off.',
  },
  {
    key: 'HTTP_TRUST_PROXY_CIDRS',
    owner: 'platform-http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    targetRequired: true,
    description: 'Explicit trusted reverse-proxy IP/CIDR or Express subnet preset allowlist.',
  },
  {
    key: 'HTTP_CORS_ALLOWED_ORIGINS',
    owner: 'platform-http',
    category: 'ingress',
    source: 'process-env',
    defaultPolicy: 'optional',
    targetRequired: true,
    description: 'Comma-separated explicit REST CORS origin allowlist. Wildcard is rejected.',
  },
] as const);
