import Joi from 'joi';
import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import { DEFAULT_NODE_ENV, DEFAULT_PORT } from './app.config.js';
import { numberEnv, type EnvSchemaDefinition } from '../../config/environment/joi-helpers.js';

export const appEnvSchema = {
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default(DEFAULT_NODE_ENV),
  PORT: numberEnv(DEFAULT_PORT, { min: 1 }),
  TZ: Joi.string().trim().optional(),
} satisfies EnvSchemaDefinition;

export const appEnvKeys = defineEnvKeys([
  {
    key: 'NODE_ENV',
    owner: 'platform-runtime',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'API runtime environment selector.',
  },
  {
    key: 'PORT',
    owner: 'platform-runtime',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'HTTP listen port for the NestJS API process.',
  },
  {
    key: 'TZ',
    owner: 'platform-runtime',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Container process timezone display preference.',
  },
] as const);
