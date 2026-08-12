import Joi from 'joi';
import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import {
  DEFAULT_LOG_HASH_SECRET,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_PRETTY,
  DEFAULT_METRICS_ENABLED,
  DEFAULT_OBSERVABILITY_SERVICE_NAME,
} from './observability.config.js';
import {
  booleanEnv,
  isForbiddenProductionValue,
  productionRequiredString,
  type EnvSchemaDefinition,
} from '../../config/environment/joi-helpers.js';

const requiredProductionMetricsBearerToken = Joi.string()
  .trim()
  .custom((value: string, helpers) => {
    if (isForbiddenProductionValue(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'production metrics token guard')
  .required();

export const observabilityEnvSchema = {
  OBSERVABILITY_SERVICE_NAME: Joi.string().trim().default(DEFAULT_OBSERVABILITY_SERVICE_NAME),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default(DEFAULT_LOG_LEVEL),
  LOG_HASH_SECRET: productionRequiredString({
    nonProductionDefault: DEFAULT_LOG_HASH_SECRET,
    forbidProductionPlaceholder: true,
  }),
  LOG_PRETTY: booleanEnv(DEFAULT_LOG_PRETTY),
  METRICS_ENABLED: booleanEnv(DEFAULT_METRICS_ENABLED),
  METRICS_BEARER_TOKEN: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: requiredProductionMetricsBearerToken,
      otherwise: Joi.string().trim().allow('').optional(),
    }),
} satisfies EnvSchemaDefinition;

export const observabilityEnvKeys = defineEnvKeys([
  {
    key: 'OBSERVABILITY_SERVICE_NAME',
    owner: 'platform-observability',
    category: 'observability',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Service name label used by logs and metrics.',
  },
  {
    key: 'LOG_LEVEL',
    owner: 'platform-observability',
    category: 'observability',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Structured logger level.',
  },
  {
    key: 'LOG_HASH_SECRET',
    owner: 'platform-observability',
    category: 'secret',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'Secret used to hash privacy-sensitive log identifiers.',
  },
  {
    key: 'LOG_PRETTY',
    owner: 'platform-observability',
    category: 'observability',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Pretty log toggle for local development.',
  },
  {
    key: 'METRICS_ENABLED',
    owner: 'platform-observability',
    category: 'observability',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Prometheus metrics endpoint toggle.',
  },
  {
    key: 'METRICS_BEARER_TOKEN',
    owner: 'platform-observability',
    category: 'secret',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'Bearer token required for production metrics scrape.',
  },
] as const);
