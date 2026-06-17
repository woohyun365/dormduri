import Joi from 'joi';
import { DEFAULT_SECRET_SOURCE } from '../secret-source.config.js';
import type { EnvSchemaDefinition } from './joi-helpers.js';

export const secretSourceEnvSchema = {
  SECRET_SOURCE: Joi.string().valid('env', 'aws-secrets-manager').default(DEFAULT_SECRET_SOURCE),
} satisfies EnvSchemaDefinition;
