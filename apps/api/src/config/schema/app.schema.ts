import Joi from 'joi';
import { DEFAULT_NODE_ENV, DEFAULT_PORT } from '../app.config.js';
import { numberEnv, type EnvSchemaDefinition } from './joi-helpers.js';

export const appEnvSchema = {
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default(DEFAULT_NODE_ENV),
  PORT: numberEnv(DEFAULT_PORT, { min: 1 }),
  TZ: Joi.string().trim().optional(),
} satisfies EnvSchemaDefinition;
