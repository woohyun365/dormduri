import { defineEnvKeys } from './env-key.definition.js';

export const retentionEnvKeys = defineEnvKeys([
  {
    key: 'RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64',
    owner: 'retention',
    category: 'secret',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'Base64 identity encryption key for retention workflows.',
  },
  {
    key: 'RETENTION_IDENTITY_KEY_VERSION',
    owner: 'retention',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Identity encryption key version marker.',
  },
  {
    key: 'RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64',
    owner: 'retention',
    category: 'secret',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'Base64 chat body encryption key for retention vault.',
  },
  {
    key: 'RETENTION_VAULT_CHAT_BODY_KEY_VERSION',
    owner: 'retention',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Retention vault chat body key version marker.',
  },
] as const);
