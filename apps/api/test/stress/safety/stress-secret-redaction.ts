const REDACTED_STRESS_SECRET = '[REDACTED_STRESS_SECRET]' as const;

const SENSITIVE_KEY_PATTERN =
  /(?:email|password|passphrase|token|secret|cookie|authorization|authHeader|session|refresh|accessToken)/iu;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
const AUTH_VALUE_PATTERN = /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/giu;
const COOKIE_VALUE_PATTERN = /\b(?:session|refresh|access|token|jwt|sid)=([^;\s]+)/giu;

export type RedactedStressValue =
  | null
  | string
  | number
  | boolean
  | readonly RedactedStressValue[]
  | { readonly [key: string]: RedactedStressValue };

export function redactStressFixtureSecrets<T>(value: T): RedactedStressValue {
  return redactValue(value, undefined);
}

export function getStressRedactedPlaceholder() {
  return REDACTED_STRESS_SECRET;
}

function redactValue(value: unknown, key: string | undefined): RedactedStressValue {
  if (key && isSensitiveKey(key)) {
    return REDACTED_STRESS_SECRET;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, undefined));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    );
  }

  return REDACTED_STRESS_SECRET;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function redactString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, REDACTED_STRESS_SECRET)
    .replace(AUTH_VALUE_PATTERN, REDACTED_STRESS_SECRET)
    .replace(COOKIE_VALUE_PATTERN, (match) => match.replace(/=.*/u, `=${REDACTED_STRESS_SECRET}`));
}
