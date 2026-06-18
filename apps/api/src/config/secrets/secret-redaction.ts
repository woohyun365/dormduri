export const SECRET_REDACTED_VALUE = '[REDACTED_SECRET]';
export const SECRET_PLACEHOLDER_REDACTED_VALUE = '[REDACTED_PLACEHOLDER]';

const credentialUrlPattern = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/?#@]+:)([^\s/?#@]+)(@)/gi;
const bearerTokenPattern = /\bBearer\s+[^\s,;]+/gi;
const credentialAssignmentPattern =
  /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*=)([^\s,;]+)/gi;
const replacementPlaceholderPattern = /\bREPLACE(?:_WITH)?_[A-Z0-9_]+\b/g;

export function redactSecretText(
  value: string,
  explicitSecretValues: readonly string[] = [],
): string {
  const sortedSecretValues = explicitSecretValues
    .map((secret) => secret.trim())
    .filter((secret) => secret.length > 0)
    .sort((left, right) => right.length - left.length);

  let redacted = value;
  for (const secret of sortedSecretValues) {
    redacted = redacted.split(secret).join(SECRET_REDACTED_VALUE);
  }

  return redacted
    .replace(credentialUrlPattern, `$1${SECRET_REDACTED_VALUE}$3`)
    .replace(bearerTokenPattern, `Bearer ${SECRET_REDACTED_VALUE}`)
    .replace(credentialAssignmentPattern, `$1${SECRET_REDACTED_VALUE}`)
    .replace(replacementPlaceholderPattern, SECRET_PLACEHOLDER_REDACTED_VALUE);
}

export function redactSecretError(
  error: unknown,
  explicitSecretValues: readonly string[] = [],
): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSecretText(error.message, explicitSecretValues),
    };
  }

  return {
    name: 'UnknownError',
    message: redactSecretText(String(error), explicitSecretValues),
  };
}
