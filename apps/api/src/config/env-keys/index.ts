import { appEnvKeys } from './app-env.keys.js';
import { authEnvKeys } from './auth-env.keys.js';
import { databaseEnvKeys } from './database-env.keys.js';
import { emailEnvKeys } from './email-env.keys.js';
import { httpEnvKeys } from './http-env.keys.js';
import { lifecycleEnvKeys } from './lifecycle-env.keys.js';
import { observabilityEnvKeys } from './observability-env.keys.js';
import { paginationEnvKeys } from './pagination-env.keys.js';
import { realtimeEnvKeys } from './realtime-env.keys.js';
import { retentionEnvKeys } from './retention-env.keys.js';
import { secretSourceEnvKeys } from './secret-source-env.keys.js';
import type { EnvKeyDefinition } from './env-key.definition.js';

export type { EnvKeyDefinition } from './env-key.definition.js';

export const ALL_ENV_KEYS: readonly EnvKeyDefinition[] = [
  ...appEnvKeys,
  ...databaseEnvKeys,
  ...observabilityEnvKeys,
  ...authEnvKeys,
  ...emailEnvKeys,
  ...httpEnvKeys,
  ...realtimeEnvKeys,
  ...lifecycleEnvKeys,
  ...retentionEnvKeys,
  ...paginationEnvKeys,
  ...secretSourceEnvKeys,
];

export function findEnvKeyDefinition(key: string): EnvKeyDefinition | undefined {
  return ALL_ENV_KEYS.find((definition) => definition.key === key);
}

export const requiredProductionEnvKeys = ALL_ENV_KEYS.filter(
  (definition) => definition.requiredInProduction === true,
);

export const secretEnvKeys = ALL_ENV_KEYS.filter((definition) => definition.secret === true);

export const productionDefaultForbiddenEnvKeys = ALL_ENV_KEYS.filter(
  (definition) => definition.forbidProductionPlaceholder === true,
);
