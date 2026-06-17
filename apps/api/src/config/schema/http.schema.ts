import Joi from 'joi';
import { DEFAULT_HTTP_COOKIE_SAME_SITE, DEFAULT_HTTP_TRUST_PROXY } from '../http.config.js';
import { booleanEnv, type EnvSchemaDefinition } from './joi-helpers.js';

export const httpEnvSchema = {
  HTTP_TRUST_PROXY: booleanEnv(DEFAULT_HTTP_TRUST_PROXY),
  HTTP_CORS_ALLOWED_ORIGINS: Joi.string().trim().allow('').optional(),
  HTTP_COOKIE_SECURE: Joi.boolean()
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
    }),
  HTTP_COOKIE_SAME_SITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default(DEFAULT_HTTP_COOKIE_SAME_SITE),
  HTTP_COOKIE_DOMAIN: Joi.string().trim().allow('').optional(),
} satisfies EnvSchemaDefinition;
