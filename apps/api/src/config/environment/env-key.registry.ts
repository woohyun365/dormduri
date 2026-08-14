import { API_ENV_KEYS } from '../composition/api-config.registry.js';
import type { EnvKeyDefinition } from './env-key.definition.js';

export type { EnvDeploymentScope, EnvKeyDefinition } from './env-key.definition.js';

export const ALL_ENV_KEYS: readonly EnvKeyDefinition[] = API_ENV_KEYS;

export function findEnvKeyDefinition(key: string): EnvKeyDefinition | undefined {
  return ALL_ENV_KEYS.find((definition) => definition.key === key);
}

export const requiredProductionEnvKeys = ALL_ENV_KEYS.filter(
  (definition) => definition.requiredInProduction === true,
);

export const runtimeEnvKeys = ALL_ENV_KEYS.filter(
  (definition) => (definition.deploymentScope ?? 'runtime') === 'runtime',
);

export const deployTimeEnvKeys = ALL_ENV_KEYS.filter(
  (definition) => definition.deploymentScope === 'migration',
);

export const runtimeRequiredProductionEnvKeys = runtimeEnvKeys.filter(
  (definition) => definition.requiredInProduction === true,
);

export const deployTimeRequiredEnvKeys = deployTimeEnvKeys.filter(
  (definition) => definition.requiredForDeployment === true,
);

export const secretEnvKeys = ALL_ENV_KEYS.filter((definition) => definition.secret === true);

export const runtimeSecretEnvKeys = runtimeEnvKeys.filter(
  (definition) => definition.secret === true,
);

export const deployTimeSecretEnvKeys = deployTimeEnvKeys.filter(
  (definition) => definition.secret === true,
);

export const productionDefaultForbiddenEnvKeys = ALL_ENV_KEYS.filter(
  (definition) => definition.forbidProductionPlaceholder === true,
);
