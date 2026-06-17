import {
  DEFAULT_LIFECYCLE_SWEEP_ENABLED,
  DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS,
} from '../lifecycle.config.js';
import { booleanEnv, numberEnv, type EnvSchemaDefinition } from './joi-helpers.js';

export const lifecycleEnvSchema = {
  LIFECYCLE_SWEEP_ENABLED: booleanEnv(DEFAULT_LIFECYCLE_SWEEP_ENABLED),
  LIFECYCLE_SWEEP_INTERVAL_MS: numberEnv(DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS, { min: 1_000 }),
} satisfies EnvSchemaDefinition;
