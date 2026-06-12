import { expect } from 'vitest';
const sensitiveLifecycleMetadataKeys = [
  'note',
  'profile',
  'lifestyle',
  'chatBody',
  'messageBody',
  'retainedBody',
  'vaultPayload',
  'email',
  'phone',
  'token',
  'providerAccessToken',
  'requestBody',
  'responseBody',
  'stack',
  'prismaError',
  'internalAuditPayload',
  'identitySnapshot',
] as const;

export function expectLifecycleMetadataToExcludeSensitiveKeys(metadata: unknown) {
  const metadataKeys = collectJsonObjectKeys(metadata);

  for (const sensitiveKey of sensitiveLifecycleMetadataKeys) {
    expect(metadataKeys).not.toContain(sensitiveKey);
  }
}

function collectJsonObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectJsonObjectKeys);
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => [
    key,
    ...collectJsonObjectKeys(nestedValue),
  ]);
}
