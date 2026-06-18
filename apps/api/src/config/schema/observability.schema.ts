import Joi from 'joi';
import {
  DEFAULT_LOG_HASH_SECRET,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_PRETTY,
  DEFAULT_METRICS_ENABLED,
  DEFAULT_OBSERVABILITY_SERVICE_NAME,
} from '../observability.config.js';
import {
  booleanEnv,
  isForbiddenProductionValue,
  productionRequiredString,
  type EnvSchemaDefinition,
} from './joi-helpers.js';

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
