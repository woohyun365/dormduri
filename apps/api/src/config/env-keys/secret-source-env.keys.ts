import { defineEnvKeys } from './env-key.definition.js';

export const secretSourceEnvKeys = defineEnvKeys([
  {
    key: 'SECRET_SOURCE',
    owner: 'secrets',
    category: 'secret',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Secret materialization source: env or aws-secrets-manager.',
  },
] as const);
