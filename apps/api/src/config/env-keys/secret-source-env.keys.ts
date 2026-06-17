import { SECRET_NAME_PREFIX_ENV } from '../secrets/secret-name-prefix.constants.js';
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
  {
    key: SECRET_NAME_PREFIX_ENV,
    owner: 'secrets',
    category: 'secret',
    source: 'process-env',
    defaultPolicy: 'optional',
    description:
      'AWS Secrets Manager secret name prefix, for example /knu-roommate/production/api.',
  },
] as const);
