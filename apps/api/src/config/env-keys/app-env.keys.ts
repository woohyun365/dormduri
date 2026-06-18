import { defineEnvKeys } from './env-key.definition.js';

export const appEnvKeys = defineEnvKeys([
  {
    key: 'NODE_ENV',
    owner: 'app',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'API runtime environment selector.',
  },
  {
    key: 'PORT',
    owner: 'app',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'HTTP listen port for the NestJS API process.',
  },
  {
    key: 'TZ',
    owner: 'app',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Container process timezone display preference.',
  },
] as const);
