import { registerAs } from '@nestjs/config';
import { readStringEnv } from '../../config/environment/env.helpers.js';
import { SECRET_NAME_PREFIX_ENV } from '../../config/secrets/secret-name-prefix.constants.js';

export const SECRET_SOURCE_ENV = 'SECRET_SOURCE';
export const SECRET_MOUNT_DIRECTORY_ENV = 'SECRET_MOUNT_DIRECTORY';
export const DEFAULT_SECRET_SOURCE = 'env' as const;

export const SUPPORTED_SECRET_SOURCES = ['env', 'mounted-files', 'aws-secrets-manager'] as const;

export type SecretSource = (typeof SUPPORTED_SECRET_SOURCES)[number];

export function readSecretMountDirectory(env: NodeJS.ProcessEnv = process.env): string | null {
  const directory = env[SECRET_MOUNT_DIRECTORY_ENV]?.trim();
  return directory && directory.length > 0 ? directory : null;
}

export function readSecretNamePrefix(env: NodeJS.ProcessEnv = process.env): string | null {
  const prefix = env[SECRET_NAME_PREFIX_ENV]?.trim();
  return prefix && prefix.length > 0 ? prefix : null;
}

export function readSecretSource(env: NodeJS.ProcessEnv = process.env): SecretSource {
  const source = readStringEnv(env, SECRET_SOURCE_ENV, DEFAULT_SECRET_SOURCE).toLowerCase();
  if (source === 'env' || source === 'mounted-files' || source === 'aws-secrets-manager') {
    return source;
  }

  throw new Error(
    `[config] ${SECRET_SOURCE_ENV} must be one of env, mounted-files, aws-secrets-manager.`,
  );
}

export default registerAs('secretSource', () => ({
  source: readSecretSource(process.env),
  secretMountDirectory: readSecretMountDirectory(process.env),
  secretNamePrefix: readSecretNamePrefix(process.env),
}));
