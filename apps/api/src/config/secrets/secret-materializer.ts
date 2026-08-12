import {
  readSecretSource,
  type SecretSource,
} from '../../platform/runtime/secret-source.config.js';
import { runtimeSecretEnvKeys } from '../environment/env-key.registry.js';
import { AwsSecretsManagerSecretReader } from './readers/aws-secrets-manager-secret-reader.js';
import { EnvSecretReader } from './readers/env-secret-reader.js';
import { MountedFileSecretReader } from './readers/mounted-file-secret-reader.js';
import { listSecretNameMappings } from './secret-name-registry.js';
import type { SecretReaderPort } from './secret-reader.port.js';

export interface SecretMaterializerOptions {
  readonly source?: SecretSource;
  readonly env?: NodeJS.ProcessEnv;
  readonly nodeEnv?: string;
  readonly secretNamePrefix?: string | null;
  readonly secretMountDirectory?: string | null;
  readonly reader?: SecretReaderPort;
  readonly signal?: AbortSignal;
}

export async function materializeRequiredSecrets(
  options: SecretMaterializerOptions = {},
): Promise<Record<string, string>> {
  const env = options.env ?? process.env;
  const source = options.source ?? readSecretSource(env);
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? 'development';
  const requiredEnvKeys = selectRequiredSecretEnvKeys({ env, nodeEnv, source });

  if (source === 'env') {
    const reader = options.reader ?? new EnvSecretReader(env);
    return reader.readRequiredSecrets(requiredEnvKeys, { signal: options.signal });
  }

  if (source === 'mounted-files') {
    const mountDirectory = options.secretMountDirectory ?? env.SECRET_MOUNT_DIRECTORY?.trim();
    if (!mountDirectory) {
      throw new Error('Mounted secret source requires a mount directory.');
    }
    const reader = options.reader ?? new MountedFileSecretReader(mountDirectory);
    return reader.readRequiredSecrets(requiredEnvKeys, { signal: options.signal });
  }

  const reader = options.reader ?? new AwsSecretsManagerSecretReader();
  const mappings = listSecretNameMappings({
    nodeEnv,
    prefix: options.secretNamePrefix ?? env.SECRET_NAME_PREFIX ?? null,
  }).filter(({ envKey }) => requiredEnvKeys.includes(envKey));
  const materializedEntries = await Promise.all(
    mappings.map(async ({ envKey, secretName }) => [
      envKey,
      await reader.readSecret(secretName, { signal: options.signal }),
    ]),
  );

  return Object.fromEntries(materializedEntries) as Record<string, string>;
}

function selectRequiredSecretEnvKeys(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly nodeEnv: string;
  readonly source: SecretSource;
}): string[] {
  if (options.source !== 'env' || options.nodeEnv === 'production') {
    return runtimeSecretEnvKeys
      .filter((definition) => definition.requiredInProduction === true)
      .map((definition) => definition.key);
  }

  return runtimeSecretEnvKeys
    .filter(({ key }) => {
      const value = options.env[key];
      return typeof value === 'string' && value.trim().length > 0;
    })
    .map((definition) => definition.key);
}

export function applyMaterializedSecretsToEnv(
  targetEnv: NodeJS.ProcessEnv,
  materializedSecrets: Readonly<Record<string, string>>,
): void {
  for (const [key, value] of Object.entries(materializedSecrets)) {
    targetEnv[key] = value;
  }
}
