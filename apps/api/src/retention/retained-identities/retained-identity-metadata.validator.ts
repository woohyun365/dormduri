export interface RetainedIdentityMetadata {
  schemaVersion: 1;
  migration?: {
    source: 'ACCOUNT_DELETE' | 'SYSTEM_BACKFILL';
    note?: string;
  };
  request?: {
    requestedBy: 'USER' | 'ADMIN' | 'SYSTEM';
    note?: string;
  };
  debug?: {
    note?: string;
  };
}

const ALLOWED_TOP_LEVEL_KEYS = new Set(['schemaVersion', 'migration', 'request', 'debug']);
const FORBIDDEN_IDENTIFIER_KEYS = new Set([
  'email',
  'emailNormalized',
  'nickname',
  'nicknameNormalized',
  'userId',
  'originalUserId',
]);

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function assertNoForbiddenIdentifierKeys(input: Record<string, unknown>) {
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_IDENTIFIER_KEYS.has(key)) {
      throw new Error('[retained-identity-metadata] direct identifiers are not allowed');
    }

    if (isPlainObject(value)) {
      assertNoForbiddenIdentifierKeys(value);
    }
  }
}

export function validateRetainedIdentityMetadata(input: unknown): RetainedIdentityMetadata | null {
  if (input == null) {
    return null;
  }
  if (!isPlainObject(input)) {
    throw new Error('[retained-identity-metadata] metadata must be a plain object');
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`[retained-identity-metadata] unsupported metadata key: ${key}`);
    }
  }

  assertNoForbiddenIdentifierKeys(input);

  if (input.schemaVersion !== 1) {
    throw new Error('[retained-identity-metadata] schemaVersion=1 is required');
  }

  if (
    input.migration !== undefined &&
    (!isPlainObject(input.migration) ||
      !['ACCOUNT_DELETE', 'SYSTEM_BACKFILL'].includes(String(input.migration.source)))
  ) {
    throw new Error('[retained-identity-metadata] invalid migration metadata');
  }

  if (
    input.request !== undefined &&
    (!isPlainObject(input.request) ||
      !['USER', 'ADMIN', 'SYSTEM'].includes(String(input.request.requestedBy)))
  ) {
    throw new Error('[retained-identity-metadata] invalid request metadata');
  }

  if (input.debug !== undefined && !isPlainObject(input.debug)) {
    throw new Error('[retained-identity-metadata] invalid debug metadata');
  }

  return input as unknown as RetainedIdentityMetadata;
}
