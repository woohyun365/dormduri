const ERROR_TYPES = new Set([
  'AbortError',
  'AggregateError',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

export function normalizeOperationalErrorType(error: unknown): string {
  if (!(error instanceof Error) || !ERROR_TYPES.has(error.name)) return 'unknown';
  return error.name;
}

export function createOperationalErrorFingerprint(error: unknown): string {
  const type = normalizeOperationalErrorType(error);
  const raw = error instanceof Error ? `${type}:${error.message}:${error.stack ?? ''}` : type;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `err_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
