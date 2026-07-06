const HIDDEN_RAW_KEY_FRAGMENTS = [
  ['drink', 'ing', 'Frequency'],
  ['drink', 'ing', 'Tolerance'],
  ['target', 'Condition'],
  ['viewer', 'Value'],
  ['target', 'Value'],
  ['matrix', 'Key'],
] as const;

export const COMPATIBILITY_PRIVACY_FORBIDDEN_TOKENS: readonly string[] =
  HIDDEN_RAW_KEY_FRAGMENTS.map((parts) => parts.join(''));

export function findCompatibilityPrivacyViolations(input: string): readonly string[] {
  const normalized = input.toLowerCase();
  return COMPATIBILITY_PRIVACY_FORBIDDEN_TOKENS.filter((token) =>
    normalized.includes(token.toLowerCase()),
  );
}

export function assertCompatibilityPrivacySafe(input: string): void {
  const violations = findCompatibilityPrivacyViolations(input);
  if (violations.length > 0) {
    throw new Error('Compatibility copy contains hidden/raw profile key.');
  }
}
