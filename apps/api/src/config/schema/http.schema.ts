import Joi, { type CustomHelpers } from 'joi';
import { DEFAULT_HTTP_COOKIE_SAME_SITE, DEFAULT_HTTP_TRUST_PROXY } from '../http.config.js';
import { booleanEnv, type EnvSchemaDefinition } from './joi-helpers.js';

const httpCookieSecureEnv = Joi.boolean()
  .truthy('1')
  .truthy('true')
  .truthy('yes')
  .truthy('on')
  .falsy('0')
  .falsy('false')
  .falsy('no')
  .falsy('off')
  .when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().default(true),
    otherwise: Joi.boolean().default(false),
  })
  .when('HTTP_COOKIE_SAME_SITE', {
    is: 'none',
    then: Joi.boolean().valid(true),
  });

export const httpEnvSchema = {
  HTTP_TRUST_PROXY: booleanEnv(DEFAULT_HTTP_TRUST_PROXY),
  HTTP_CORS_ALLOWED_ORIGINS: explicitCorsOriginListEnv(),
  HTTP_COOKIE_SECURE: httpCookieSecureEnv,
  HTTP_COOKIE_SAME_SITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default(DEFAULT_HTTP_COOKIE_SAME_SITE),
  HTTP_COOKIE_DOMAIN: cookieDomainEnv(),
} satisfies EnvSchemaDefinition;

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

function cookieDomainEnv() {
  return Joi.string()
    .trim()
    .allow('')
    .optional()
    .custom((value: string, helpers: CustomHelpers) => {
      if (!value) {
        return value;
      }

      if (/\s/.test(value) || value.includes('://') || value.includes('/')) {
        return helpers.error('any.invalid');
      }

      return value;
    }, 'cookie domain');
}
