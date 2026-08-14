import {
  ALL_ENV_KEYS,
  deployTimeRequiredEnvKeys,
  runtimeRequiredProductionEnvKeys,
} from '../environment/env-key.registry.js';
import type { EnvDeploymentScope, EnvKeyDefinition } from '../environment/env-key.definition.js';

export const API_DEPLOYMENT_ENV_MANIFEST_VERSION = 1 as const;

type DeploymentEnvManifestEntry = Readonly<{
  key: string;
  owner: EnvKeyDefinition['owner'];
  category: EnvKeyDefinition['category'];
  source: EnvKeyDefinition['source'];
  defaultPolicy: EnvKeyDefinition['defaultPolicy'];
  scope: EnvDeploymentScope;
  requiredInProduction: boolean;
  requiredForDeployment: boolean;
  secret: boolean;
  targetRequired: boolean;
  forbidProductionPlaceholder: boolean;
}>;

export type ApiDeploymentEnvManifest = Readonly<{
  version: typeof API_DEPLOYMENT_ENV_MANIFEST_VERSION;
  generatedFrom: 'apps/api/src/config/composition/api-config.registry.ts';
  entries: readonly DeploymentEnvManifestEntry[];
  projections: Readonly<{
    containerStartupRequired: readonly string[];
    migrationRequired: readonly string[];
    runtimeSecrets: readonly string[];
    migrationSecrets: readonly string[];
    targetRequired: readonly string[];
  }>;
}>;

function scopeOf(definition: EnvKeyDefinition): EnvDeploymentScope {
  return definition.deploymentScope ?? 'runtime';
}

function sortedKeys(definitions: readonly EnvKeyDefinition[]): string[] {
  return definitions.map(({ key }) => key).sort();
}

export function createApiDeploymentEnvManifest(): ApiDeploymentEnvManifest {
  const entries = ALL_ENV_KEYS.map(
    (definition): DeploymentEnvManifestEntry => ({
      key: definition.key,
      owner: definition.owner,
      category: definition.category,
      source: definition.source,
      defaultPolicy: definition.defaultPolicy,
      scope: scopeOf(definition),
      requiredInProduction: definition.requiredInProduction === true,
      requiredForDeployment: definition.requiredForDeployment === true,
      secret: definition.secret === true,
      targetRequired: definition.targetRequired === true,
      forbidProductionPlaceholder: definition.forbidProductionPlaceholder === true,
    }),
  ).sort((left, right) => left.key.localeCompare(right.key));

  return {
    version: API_DEPLOYMENT_ENV_MANIFEST_VERSION,
    generatedFrom: 'apps/api/src/config/composition/api-config.registry.ts',
    entries,
    projections: {
      containerStartupRequired: sortedKeys(runtimeRequiredProductionEnvKeys),
      migrationRequired: sortedKeys(deployTimeRequiredEnvKeys),
      runtimeSecrets: entries
        .filter((entry) => entry.scope === 'runtime' && entry.secret)
        .map(({ key }) => key),
      migrationSecrets: entries
        .filter((entry) => entry.scope === 'migration' && entry.secret)
        .map(({ key }) => key),
      targetRequired: entries.filter((entry) => entry.targetRequired).map(({ key }) => key),
    },
  };
}

export function serializeApiDeploymentEnvManifest(manifest: ApiDeploymentEnvManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
