import { readSecretSource, type SecretSource } from '../secret-source.config.js';
import { AwsSecretsManagerSecretReader } from './aws-secrets-manager-secret-reader.js';
import { EnvSecretReader } from './env-secret-reader.js';
import { listSecretNameMappings } from './secret-name-registry.js';
import type { SecretReaderPort } from './secret-reader.port.js';

export interface SecretMaterializerOptions {
  readonly source?: SecretSource;
  readonly env?: NodeJS.ProcessEnv;
  readonly nodeEnv?: string;
  readonly secretNamePrefix?: string | null;
  readonly reader?: SecretReaderPort;
}

export async function materializeRequiredSecrets(
  options: SecretMaterializerOptions = {},
): Promise<Record<string, string>> {
  const env = options.env ?? process.env;
  const source = options.source ?? readSecretSource(env);

  if (source === 'env') {
    const reader = options.reader ?? new EnvSecretReader(env);
    return reader.readRequiredSecrets(listSecretNameMappings().map((mapping) => mapping.envKey));
  }

  const reader = options.reader ?? new AwsSecretsManagerSecretReader();
  const mappings = listSecretNameMappings({
    nodeEnv: options.nodeEnv ?? env.NODE_ENV,
    prefix: options.secretNamePrefix ?? env.SECRET_NAME_PREFIX ?? null,
  });
  const materializedEntries = await Promise.all(
    mappings.map(async ({ envKey, secretName }) => [envKey, await reader.readSecret(secretName)]),
  );

  return Object.fromEntries(materializedEntries) as Record<string, string>;
}

export function applyMaterializedSecretsToEnv(
  targetEnv: NodeJS.ProcessEnv,
  materializedSecrets: Readonly<Record<string, string>>,
): void {
  for (const [key, value] of Object.entries(materializedSecrets)) {
    targetEnv[key] = value;
  }
}
