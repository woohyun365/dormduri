import type { MatchingNavOptions } from './navigation';

const ownedKeys = ['section', 'requestTab'] as const;

export interface MatchingRouteQueryParseResult {
  readonly selection: MatchingNavOptions;
  readonly canonicalSearchParams: URLSearchParams;
  readonly needsCanonicalization: boolean;
}

export function parseMatchingRouteQuery(
  searchParams: URLSearchParams,
): MatchingRouteQueryParseResult {
  const section = parseOwnedValue(searchParams, 'section', ['current', 'past']);
  const requestTab = parseOwnedValue(searchParams, 'requestTab', ['sent', 'received']);
  const selection: MatchingNavOptions = {
    ...(section ? { section } : {}),
    ...(requestTab ? { requestTab } : {}),
  };
  const canonicalSearchParams = serializeMatchingRouteQuery(searchParams, selection);
  const needsCanonicalization = ownedKeys.some((key) => {
    const values = searchParams.getAll(key);
    if (values.length === 0) return false;
    if (values.length !== 1) return true;
    return key === 'section' ? !section : !requestTab;
  });

  return {
    selection,
    canonicalSearchParams,
    needsCanonicalization,
  };
}

export function serializeMatchingRouteQuery(
  searchParams: URLSearchParams,
  selection: MatchingNavOptions,
): URLSearchParams {
  const result = new URLSearchParams(searchParams);
  for (const key of ownedKeys) result.delete(key);
  if (selection.section) result.append('section', selection.section);
  if (selection.requestTab) result.append('requestTab', selection.requestTab);
  return result;
}

function parseOwnedValue<const Value extends string>(
  searchParams: URLSearchParams,
  key: (typeof ownedKeys)[number],
  allowedValues: readonly Value[],
): Value | undefined {
  const values = searchParams.getAll(key);
  if (values.length !== 1) return undefined;
  return allowedValues.includes(values[0] as Value) ? (values[0] as Value) : undefined;
}
