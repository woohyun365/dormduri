import Joi, { type CustomHelpers } from 'joi';
import { DEFAULT_SECRET_SOURCE } from '../secret-source.config.js';
import { SECRET_NAME_PREFIX_ENV } from '../secrets/secret-name-prefix.constants.js';
import type { EnvSchemaDefinition } from './joi-helpers.js';
import { isForbiddenProductionValue } from './joi-helpers.js';

export const secretSourceEnvSchema = {
  SECRET_SOURCE: Joi.string().valid('env', 'aws-secrets-manager').default(DEFAULT_SECRET_SOURCE),
  [SECRET_NAME_PREFIX_ENV]: Joi.string()
    .trim()
    .when('SECRET_SOURCE', {
      is: 'aws-secrets-manager',
      then: Joi.when('NODE_ENV', {
        is: 'production',
        then: secretNamePrefixSchema().required(),
        otherwise: secretNamePrefixSchema().optional(),
      }),
      otherwise: secretNamePrefixSchema().optional(),
    }),
} satisfies EnvSchemaDefinition;

function secretNamePrefixSchema() {
  return Joi.string().trim().custom(validateSecretNamePrefix, 'secret name prefix guard');
}

function validateSecretNamePrefix(value: string, helpers: CustomHelpers): string {
  if (!value.startsWith('/')) {
    return helpers.error('any.invalid') as never;
  }

  if (value.includes('//')) {
    return helpers.error('any.invalid') as never;
  }

  if (isProductionValidation(helpers) && isForbiddenProductionValue(value)) {
    return helpers.error('any.invalid') as never;
  }

  return value.replace(/\/+$/u, '');
}

function isProductionValidation(helpers: CustomHelpers): boolean {
  const ancestors = helpers.state.ancestors as unknown[];
  const root = ancestors[0];
  return isRecord(root) && root.NODE_ENV === 'production';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
