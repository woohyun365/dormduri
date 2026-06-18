export const LOG_REDACTED_VALUE = '[REDACTED]';

const forbiddenKeyPatterns = [
  /authorization/i,
  /^cookie$/i,
  /password/i,
  /access.?token/i,
  /refresh.?token/i,
  /\btoken\b/i,
  /secret/i,
  /verification.?code/i,
  /^email$/i,
  /request.?body/i,
  /response.?body/i,
  /body$/i,
  /payload/i,
  /vault/i,
  /encrypted/i,
  /message.?body/i,
  /support.?body/i,
  /report.?detail/i,
  /raw.?ip/i,
  /^ip$/i,
];

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const bearerTokenPattern = /Bearer\s+[^\s,;]+/gi;
const jwtLikePattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const credentialAssignmentPattern =
  /\b(password|token|secret|cookie|verificationCode)=([^\s,;]+)/gi;

export function isForbiddenLogKey(key: string): boolean {
  return forbiddenKeyPatterns.some((pattern) => pattern.test(key));
}

function redactString(value: string): string {
  return value
    .replace(emailPattern, LOG_REDACTED_VALUE)
    .replace(bearerTokenPattern, `Bearer ${LOG_REDACTED_VALUE}`)
    .replace(jwtLikePattern, LOG_REDACTED_VALUE)
    .replace(credentialAssignmentPattern, (_match, key: string) => `${key}=${LOG_REDACTED_VALUE}`);
}

export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      errorName: value.name,
    };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      isForbiddenLogKey(key) ? LOG_REDACTED_VALUE : redactLogValue(entryValue, seen),
    ]),
  );
}
