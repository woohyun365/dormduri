import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import {
  DEFAULT_LIFECYCLE_SWEEP_ENABLED,
  DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS,
} from './lifecycle.config.js';
import {
  booleanEnv,
  numberEnv,
  type EnvSchemaDefinition,
} from '../../config/environment/joi-helpers.js';

export const lifecycleEnvSchema = {
  LIFECYCLE_SWEEP_ENABLED: booleanEnv(DEFAULT_LIFECYCLE_SWEEP_ENABLED),
  LIFECYCLE_SWEEP_INTERVAL_MS: numberEnv(DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS, { min: 1_000 }),
} satisfies EnvSchemaDefinition;

export const lifecycleEnvKeys = defineEnvKeys([
  {
    key: 'LIFECYCLE_SWEEP_ENABLED',
    owner: 'lifecycle',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Lifecycle sweep scheduler toggle.',
  },
  {
    key: 'LIFECYCLE_SWEEP_INTERVAL_MS',
    owner: 'lifecycle',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Lifecycle sweep scheduler interval.',
  },
] as const);
