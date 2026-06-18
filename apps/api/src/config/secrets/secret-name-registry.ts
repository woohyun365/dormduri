import { secretEnvKeys } from '../env-keys/index.js';

import { SECRET_NAME_PREFIX_ENV } from './secret-name-prefix.constants.js';
export const DEFAULT_SECRET_NAME_ROOT = '/knu-roommate';

export interface SecretNameRegistryOptions {
  readonly nodeEnv?: string;
  readonly prefix?: string | null;
}

export interface SecretNameMapping {
  readonly envKey: string;
  readonly secretName: string;
}

export const secretEnvKeyNames = secretEnvKeys.map((definition) => definition.key);

export function defaultSecretNamePrefixForEnv(nodeEnv = 'development'): string {
  return `${DEFAULT_SECRET_NAME_ROOT}/${normalizeSecretPathSegment(nodeEnv)}/api`;
}

export function normalizeSecretNamePrefix(prefix: string): string {
  const normalized = prefix.trim().replace(/\/+$/u, '');
  if (!normalized.startsWith('/')) {
    throw new Error(`[config:secrets] ${SECRET_NAME_PREFIX_ENV} must start with '/'.`);
  }

  if (normalized.includes('//')) {
    throw new Error(
      `[config:secrets] ${SECRET_NAME_PREFIX_ENV} must not include empty path segments.`,
    );
  }

  return normalized;
}

export function secretNameForEnvKey(
  envKey: string,
  options: SecretNameRegistryOptions = {},
): string {
  if (!secretEnvKeyNames.includes(envKey)) {
    throw new Error(`[config:secrets] ${envKey} is not registered as a secret env key.`);
  }

  const prefix = options.prefix
    ? normalizeSecretNamePrefix(options.prefix)
    : defaultSecretNamePrefixForEnv(options.nodeEnv);

  return `${prefix}/${envKey}`;
}

export function listSecretNameMappings(
  options: SecretNameRegistryOptions = {},
): SecretNameMapping[] {
  return secretEnvKeyNames.map((envKey) => ({
    envKey,
    secretName: secretNameForEnvKey(envKey, options),
  }));
}

function normalizeSecretPathSegment(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/u.test(normalized)) {
    throw new Error('[config:secrets] secret name path segment contains unsupported characters.');
  }

  return normalized;
}
