import { defineEnvKeys } from './env-key.definition.js';

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
