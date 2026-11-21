import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ENV_VALIDATION_SCHEMA } from '../../../src/config/composition/api-config.registry.js';
import { retentionEnvKeys } from '../../../src/retention/config/retention.env.js';
import {
  parseRetentionVaultKeyPurpose,
  RETENTION_VAULT_KEY_PURPOSES,
} from '../../../src/retention/vault/retained-vault-keyring.js';

// Every vault key purpose the keyring serves must have an encryption key and a key version in the env schema and in
// every deployment contract. The env keyring has no fallback key, so a purpose without a delivered key makes its
// archive job fail with `key unavailable` (#951). The purpose type comes from the keyring list, so a purpose passed
// through a constant or a variable is still checked against the deployment contracts. The source scan only sees
// `keyPurpose: '<NAME>'` literals; it checks that production code retains payloads with exactly the listed purposes.

const sourceRoot = resolve(process.cwd(), 'src');
const manifestPath = resolve(process.cwd(), '../../infra/deploy/api/env.manifest.json');
const secretMountContractPath = resolve(
  process.cwd(),
  '../../infra/deploy/api/secret-mount.contract.json',
);
const envExamplePath = resolve(process.cwd(), '../../infra/deploy/.env.api.example');

const KEY_PURPOSE_LITERAL = /\bkeyPurpose:\s*'([A-Z][A-Z0-9_]*)'/gu;
const VAULT_ENCRYPTION_KEY = /^RETENTION_VAULT_([A-Z][A-Z0-9_]*)_ENCRYPTION_KEY_BASE64$/u;
const validBase64Key = Buffer.alloc(32, 9).toString('base64');

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function purposesInUse(): string[] {
  const purposes = new Set<string>();
  for (const path of productionSourceFiles(sourceRoot)) {
    for (const match of readFileSync(path, 'utf8').matchAll(KEY_PURPOSE_LITERAL)) {
      purposes.add(match[1] as string);
    }
  }
  return [...purposes].sort();
}

function encryptionKey(purpose: string): string {
  return `RETENTION_VAULT_${purpose}_ENCRYPTION_KEY_BASE64`;
}

function keyVersionKey(purpose: string): string {
  return `RETENTION_VAULT_${purpose}_KEY_VERSION`;
}

function vaultEncryptionKeys(keys: Iterable<string>): string[] {
  return [...new Set([...keys].filter((key) => VAULT_ENCRYPTION_KEY.test(key)))].sort();
}

function envExampleKeys(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=', 1)[0] ?? '');
}

function productionErrorPaths(env: Record<string, string>): string[] {
  const { error } = API_ENV_VALIDATION_SCHEMA.validate(
    { NODE_ENV: 'production', ...env },
    { abortEarly: false },
  );
  return error?.details.map((detail) => detail.path.join('.')) ?? [];
}

const inUse = purposesInUse();
const keyringPurposes = [...RETENTION_VAULT_KEY_PURPOSES].sort();
const expectedEncryptionKeys = keyringPurposes.map(encryptionKey).sort();

describe('retention vault key contract', () => {
  it('retains payloads with exactly the keyring purposes', () => {
    // Positive control for the source scan: the chat body archive is a known caller.
    expect(inUse).toContain('CHAT_BODY');
    expect(inUse).toEqual(keyringPurposes);
  });

  it('declares a production-required encryption key and a key version for every keyring purpose', () => {
    const definitions = new Map<string, (typeof retentionEnvKeys)[number]>(
      retentionEnvKeys.map((definition) => [definition.key, definition]),
    );

    expect(vaultEncryptionKeys(definitions.keys())).toEqual(expectedEncryptionKeys);
    for (const purpose of keyringPurposes) {
      expect(definitions.get(encryptionKey(purpose))).toMatchObject({
        owner: 'retention',
        source: 'secret-store',
        defaultPolicy: 'production-required',
        requiredInProduction: true,
        secret: true,
        forbidProductionPlaceholder: true,
      });
      expect(definitions.get(keyVersionKey(purpose))).toMatchObject({
        owner: 'retention',
        source: 'process-env',
        defaultPolicy: 'safe-local-default',
      });
    }
  });

  it.each(keyringPurposes)(
    'production env validation fails without the %s vault key',
    (purpose) => {
      const key = encryptionKey(purpose);

      expect(productionErrorPaths({})).toContain(key);
      expect(productionErrorPaths({ [key]: validBase64Key })).not.toContain(key);
    },
  );

  it('delivers every keyring purpose key through every deployment contract', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      entries: { key: string; secret: boolean; requiredInProduction: boolean }[];
      projections: { containerStartupRequired: string[]; runtimeSecrets: string[] };
    };
    const contract = JSON.parse(readFileSync(secretMountContractPath, 'utf8')) as {
      requiredFiles: string[];
    };
    const manifestKeys = new Set(manifest.entries.map((entry) => entry.key));

    expect(vaultEncryptionKeys(manifestKeys)).toEqual(expectedEncryptionKeys);
    for (const purpose of keyringPurposes) {
      expect(manifestKeys).toContain(keyVersionKey(purpose));
    }
    expect(vaultEncryptionKeys(manifest.projections.runtimeSecrets)).toEqual(
      expectedEncryptionKeys,
    );
    expect(vaultEncryptionKeys(manifest.projections.containerStartupRequired)).toEqual(
      expectedEncryptionKeys,
    );
    expect(vaultEncryptionKeys(contract.requiredFiles)).toEqual(expectedEncryptionKeys);
    expect(vaultEncryptionKeys(envExampleKeys(envExamplePath))).toEqual(expectedEncryptionKeys);
  });

  it('parses only keyring purposes and rejects the unused IDENTITY purpose', () => {
    for (const purpose of keyringPurposes) {
      expect(parseRetentionVaultKeyPurpose(purpose)).toBe(purpose);
    }
    // Retained identity anchors use the RETENTION_IDENTITY_* cipher, not a vault key purpose.
    expect(() => parseRetentionVaultKeyPurpose('IDENTITY')).toThrow('unsupported key purpose');
    expect(() => parseRetentionVaultKeyPurpose('chat_body')).toThrow('unsupported key purpose');
  });
});
