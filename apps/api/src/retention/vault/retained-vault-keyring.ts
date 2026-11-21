import { createRetentionCipher, type RetentionCipher } from '../crypto/retention-cipher.js';

const DEFAULT_VAULT_KEY_VERSION = 'local-v1';

// 용도마다 `RETENTION_VAULT_<용도>_ENCRYPTION_KEY_BASE64`·`_KEY_VERSION`을 env schema(`../config/retention.env.ts`)와 배포
// 계약이 함께 선언한다(`test/operations/platform/retention-vault-key-contract.spec.ts`). Retained identity 식별 anchor는
// vault 용도가 아니라 `RETENTION_IDENTITY_*` cipher를 쓴다.
export type RetentionVaultKeyPurpose =
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
