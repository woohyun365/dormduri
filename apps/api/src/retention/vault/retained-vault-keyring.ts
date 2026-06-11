import { createRetentionCipher, type RetentionCipher } from '../crypto/retention-cipher.js';

const DEFAULT_VAULT_KEY_VERSION = 'local-v1';

export type RetentionVaultKeyPurpose =
  | 'IDENTITY'
  | 'CHAT_BODY'
  | 'NICKNAME_AUDIT'
  | 'ACADEMIC_IDENTITY_AUDIT'
  | 'SEASON_PROFILE_HISTORY'
  | 'MATCH_HISTORY';

export interface RetentionVaultKeyring {
  getCipher(purpose: RetentionVaultKeyPurpose): RetentionCipher | null;
}

export interface RetainedVaultOwnerOptions {
  keyring?: RetentionVaultKeyring;
}

export function createRetentionVaultCipher(input: {
  key: string | Buffer;
  keyVersion: string;
}): RetentionCipher {
  return createRetentionCipher({
    key: input.key,
    keyVersion: input.keyVersion,
    errorPrefix: '[retained-vault-owner]',
  });
}

export function createStaticRetentionVaultKeyring(
  ciphers: Partial<Record<RetentionVaultKeyPurpose, RetentionCipher | null>>,
): RetentionVaultKeyring {
  return {
    getCipher(purpose) {
      return ciphers[purpose] ?? null;
    },
  };
}

export function createEnvRetentionVaultKeyring(): RetentionVaultKeyring {
  return {
    getCipher(purpose) {
      const key = process.env[`RETENTION_VAULT_${purpose}_ENCRYPTION_KEY_BASE64`]?.trim();
      if (!key) {
        return null;
      }

      const keyVersion =
        process.env[`RETENTION_VAULT_${purpose}_KEY_VERSION`]?.trim() || DEFAULT_VAULT_KEY_VERSION;
      return createRetentionVaultCipher({ key, keyVersion });
    },
  };
}

export function resolveRetentionVaultCipher(
  keyring: RetentionVaultKeyring | undefined,
  purpose: RetentionVaultKeyPurpose,
) {
  return (keyring ?? createEnvRetentionVaultKeyring()).getCipher(purpose);
}

export function parseRetentionVaultKeyPurpose(value: string): RetentionVaultKeyPurpose {
  if (
    value === 'IDENTITY' ||
    value === 'CHAT_BODY' ||
    value === 'NICKNAME_AUDIT' ||
    value === 'ACADEMIC_IDENTITY_AUDIT' ||
    value === 'SEASON_PROFILE_HISTORY' ||
    value === 'MATCH_HISTORY'
  ) {
    return value;
  }
  throw new Error('[retained-vault-owner] unsupported key purpose');
}
