import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ENV_VALIDATION_SCHEMA } from '../../../src/config/composition/api-config.registry.js';
import { retentionEnvKeys } from '../../../src/retention/config/retention.env.js';
import { parseRetentionVaultKeyPurpose } from '../../../src/retention/vault/retained-vault-keyring.js';

// The vault key purposes that production code retains payloads with must each have an encryption key and a key
// version in the env schema and in every deployment contract. The env keyring has no fallback key, so a purpose
// without a delivered key makes its archive job fail with `key unavailable` (#951).

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
const expectedEncryptionKeys = inUse.map(encryptionKey).sort();

describe('retention vault key contract', () => {
  it('finds the vault key purposes that production code retains payloads with', () => {
    // Positive control for the source scan: the chat body archive is a known caller.
    expect(inUse).toContain('CHAT_BODY');
  });

  it('declares a production-required encryption key and a key version for exactly the purposes in use', () => {
    const definitions = new Map<string, (typeof retentionEnvKeys)[number]>(
      retentionEnvKeys.map((definition) => [definition.key, definition]),
    );

    expect(vaultEncryptionKeys(definitions.keys())).toEqual(expectedEncryptionKeys);
    for (const purpose of inUse) {
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

  it.each(inUse)('production env validation fails without the %s vault key', (purpose) => {
    const key = encryptionKey(purpose);

    expect(productionErrorPaths({})).toContain(key);
    expect(productionErrorPaths({ [key]: validBase64Key })).not.toContain(key);
  });

  it('delivers the vault keys in use through every deployment contract', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      entries: { key: string; secret: boolean; requiredInProduction: boolean }[];
      projections: { containerStartupRequired: string[]; runtimeSecrets: string[] };
    };
    const contract = JSON.parse(readFileSync(secretMountContractPath, 'utf8')) as {
      requiredFiles: string[];
    };
    const manifestKeys = new Set(manifest.entries.map((entry) => entry.key));

    expect(vaultEncryptionKeys(manifestKeys)).toEqual(expectedEncryptionKeys);
    for (const purpose of inUse) {
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

  it('keeps every purpose in use parseable and rejects the unused IDENTITY purpose', () => {
    for (const purpose of inUse) {
      expect(parseRetentionVaultKeyPurpose(purpose)).toBe(purpose);
    }
    // Retained identity anchors use the RETENTION_IDENTITY_* cipher, not a vault key purpose.
    expect(() => parseRetentionVaultKeyPurpose('IDENTITY')).toThrow('unsupported key purpose');
  });
});
