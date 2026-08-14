import {
  readSecretSource,
  type SecretSource,
} from '../../platform/runtime/secret-source.config.js';
import { runtimeSecretEnvKeys } from '../environment/env-key.registry.js';
import { SECRET_NAME_PREFIX_ENV } from './secret-name-prefix.constants.js';
import { listSecretNameMappings } from './secret-name-registry.js';

export interface SecretInventoryOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly source?: SecretSource;
  readonly nodeEnv?: string;
  readonly secretNamePrefix?: string | null;
}

export interface SecretInventoryItem {
  readonly envKey: string;
  readonly owner: string;
  readonly category: string;
  readonly secretName: string | null;
}

export interface SecretInventoryReport {
  readonly source: SecretSource;
  readonly nodeEnv: string;
  readonly secretNamePrefix: string | null;
  readonly items: readonly SecretInventoryItem[];
}

export function buildSecretInventory(options: SecretInventoryOptions = {}): SecretInventoryReport {
  const env = options.env ?? process.env;
  const source = options.source ?? readSecretSource(env);
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? 'development';
  const secretNamePrefix = options.secretNamePrefix ?? env[SECRET_NAME_PREFIX_ENV]?.trim() ?? null;
  const secretNameByEnvKey = new Map(
    source === 'aws-secrets-manager'
      ? listSecretNameMappings({ nodeEnv, prefix: secretNamePrefix }).map((mapping) => [
          mapping.envKey,
          mapping.secretName,
        ])
      : [],
  );

  return {
    source,
    nodeEnv,
    secretNamePrefix,
    items: runtimeSecretEnvKeys.map((definition) => ({
      envKey: definition.key,
      owner: definition.owner,
      category: definition.category,
      secretName: secretNameByEnvKey.get(definition.key) ?? null,
    })),
  };
}

export function formatSecretInventoryReport(report: SecretInventoryReport): string {
  const lines = [
    'KNU Roommate API secret inventory dry-run',
    `source=${report.source}`,
    `nodeEnv=${report.nodeEnv}`,
    `secretNamePrefix=${report.secretNamePrefix ?? '(not set)'}`,
    'values=not printed',
  ];

  for (const item of report.items) {
    lines.push(
      item.secretName === null
        ? `${item.envKey} owner=${item.owner} category=${item.category}`
        : `${item.envKey} owner=${item.owner} category=${item.category} secretName=${item.secretName}`,
    );
  }

  return `${lines.join('\n')}\n`;
}
