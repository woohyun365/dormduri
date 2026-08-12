import { registerAs } from '@nestjs/config';
import { readStringEnv } from '../../config/environment/env.helpers.js';
import { SECRET_NAME_PREFIX_ENV } from '../../config/secrets/secret-name-prefix.constants.js';

export const SECRET_SOURCE_ENV = 'SECRET_SOURCE';
export const DEFAULT_SECRET_SOURCE = 'env' as const;

export type SecretSource = 'env' | 'aws-secrets-manager';

export function readSecretNamePrefix(env: NodeJS.ProcessEnv = process.env): string | null {
  const prefix = env[SECRET_NAME_PREFIX_ENV]?.trim();
  return prefix && prefix.length > 0 ? prefix : null;
}

export function readSecretSource(env: NodeJS.ProcessEnv = process.env): SecretSource {
  const source = readStringEnv(env, SECRET_SOURCE_ENV, DEFAULT_SECRET_SOURCE).toLowerCase();
  if (source === 'env' || source === 'aws-secrets-manager') {
    return source;
  }

  throw new Error(`[config] ${SECRET_SOURCE_ENV} must be one of env, aws-secrets-manager.`);
}

export default registerAs('secretSource', () => ({
  source: readSecretSource(process.env),
  secretNamePrefix: readSecretNamePrefix(process.env),
}));
