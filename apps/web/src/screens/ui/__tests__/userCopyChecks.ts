// Checks for user copy shared by the Legal and Landing tests and the Legal e2e (G-LU10): screen copy
// names no plan, issue, internal path, raw id or internal state. INTERNAL_COPY_PATTERN is the e2e
// negative pattern the public legal pages have kept since the legal refactor.
export const INTERNAL_COPY_PATTERN =
  /\.omx|apps\/web|web-terms-privacy-refactor-plan|active 사용자|user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i;

// Raw version keys and ids, the contract's internal state names (only addresses may carry a version
// key), plan decision ids and issue numbers.
export const RAW_ID_PATTERN =
  /\d{4}-\d{2}-\d{2}|\b(?:scheduled|current|previous|published|last-success|unavailable|version-not-found)\b|[A-Z]+_[A-Z_]+|\b[A-Z]-[A-Z]{2,}\d+\b|#\d+/u;

// Every string in a copy object, calling each copy function with the sample arguments.
export function copyStrings(value: unknown, sampleArgs: readonly string[]): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    return [String((value as (...args: string[]) => unknown)(...sampleArgs))];
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) => copyStrings(item, sampleArgs));
  }
  return [];
}
