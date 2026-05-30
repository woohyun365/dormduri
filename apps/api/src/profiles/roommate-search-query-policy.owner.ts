import type {
  RoommateSearchManifest,
  RoommateSearchQuery,
  RoommateSearchSort,
} from '@repo/shared/roommate-search-contract';
import { roommateSearchErrors } from './roommate-search.errors.js';

const FILTER_FIELDS = [
  'smokingBehavior',
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanLevel',
  'sleepHabit',
  'indoorEating',
  'relationshipStyle',
  'college',
  'grade',
  'mbtiTraits',
  'ageBand',
] as const satisfies ReadonlyArray<keyof RoommateSearchQuery>;

type FilterField = (typeof FILTER_FIELDS)[number];

export function assertRoommateSearchQueryAllowed(input: {
  query: RoommateSearchQuery;
  manifest: RoommateSearchManifest;
}): { appliedSort: RoommateSearchSort; requestedFilterFields: FilterField[] } {
  assertNoUnsupportedCompatibilityKeys(input.query);
  const appliedSort = resolveAppliedSort(input.query, input.manifest);
  const requestedFilterFields = getRequestedFilterFields(input.query);

  if (requestedFilterFields.length === 0) {
    return { appliedSort, requestedFilterFields };
  }

  if (!input.manifest.filters.enabled) {
    throw roommateSearchErrors.invalidQuery('현재 검색 범위에서는 필터를 사용할 수 없습니다.');
  }

  for (const field of requestedFilterFields) {
    assertFieldAllowed(input.query, input.manifest, field);
  }

  return { appliedSort, requestedFilterFields };
}

function assertNoUnsupportedCompatibilityKeys(query: RoommateSearchQuery) {
  if ('excludeMyCollege' in query) {
    throw roommateSearchErrors.invalidQuery('excludeMyCollege는 BE query contract가 아닙니다.');
  }
}

export function hasEffectiveRoommateSearchFilter(query: RoommateSearchQuery) {
  return getRequestedFilterFields(query).length > 0;
}

function resolveAppliedSort(
  query: RoommateSearchQuery,
  manifest: RoommateSearchManifest,
): RoommateSearchSort {
  const requestedSort = query.sort ?? manifest.sorts.default;
  if (!manifest.sorts.options.includes(requestedSort)) {
    throw roommateSearchErrors.invalidQuery(
      '현재 검색 범위에서는 요청한 정렬을 사용할 수 없습니다.',
    );
  }

  return requestedSort;
}

function getRequestedFilterFields(query: RoommateSearchQuery): FilterField[] {
  return FILTER_FIELDS.filter((field) => query[field] !== undefined);
}

function assertFieldAllowed(
  query: RoommateSearchQuery,
  manifest: RoommateSearchManifest,
  field: FilterField,
) {
  const fieldManifest = manifest.filters.fields[field];
  if (!fieldManifest?.enabled) {
    throw roommateSearchErrors.invalidQuery(
      '현재 검색 범위에서는 요청한 필터를 사용할 수 없습니다.',
    );
  }

  if (field === 'college') {
    assertOperatorFilterAllowed(query.college, fieldManifest, field);
    assertValuesInManifest(query.college.values, fieldManifest, field);
    return;
  }

  if (field === 'grade') {
    assertOperatorFilterAllowed(query.grade, fieldManifest, field);
    assertValuesInManifest(query.grade.values, fieldManifest, field);
    return;
  }

  if (field === 'ageBand') {
    assertValueFilterAllowed(query.ageBand, fieldManifest, field);
  }
}

function assertOperatorFilterAllowed(
  filter: unknown,
  fieldManifest: NonNullable<RoommateSearchManifest['filters']['fields'][string]>,
  field: string,
): asserts filter is { operator: 'INCLUDE' | 'EXCLUDE'; values: string[] } {
  if (
    !filter ||
    typeof filter !== 'object' ||
    Array.isArray(filter) ||
    !('operator' in filter) ||
    !('values' in filter)
  ) {
    throw roommateSearchErrors.invalidQuery(`${field} 필터 형식이 올바르지 않습니다.`);
  }

  const typed = filter as { operator?: unknown; values?: unknown };
  if (
    (typed.operator !== 'INCLUDE' && typed.operator !== 'EXCLUDE') ||
    !Array.isArray(typed.values) ||
    typed.values.length === 0 ||
    typed.values.some((value) => typeof value !== 'string')
  ) {
    throw roommateSearchErrors.invalidQuery(`${field} 필터 형식이 올바르지 않습니다.`);
  }

  if (!(fieldManifest.operators ?? []).includes(typed.operator)) {
    throw roommateSearchErrors.invalidQuery(
      `${field} 필터에서는 요청한 operator를 사용할 수 없습니다.`,
    );
  }
}

function assertValueFilterAllowed(
  filter: unknown,
  fieldManifest: NonNullable<RoommateSearchManifest['filters']['fields'][string]>,
  field: string,
): asserts filter is { values: string[] } {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter) || !('values' in filter)) {
    throw roommateSearchErrors.invalidQuery(`${field} 필터 형식이 올바르지 않습니다.`);
  }

  const typed = filter as { values?: unknown };
  if (!isNonEmptyStringArray(typed.values)) {
    throw roommateSearchErrors.invalidQuery(`${field} 필터 형식이 올바르지 않습니다.`);
  }

  assertValuesInManifest(typed.values, fieldManifest, field);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')
  );
}

function assertValuesInManifest(
  values: string[],
  fieldManifest: NonNullable<RoommateSearchManifest['filters']['fields'][string]>,
  field: string,
) {
  if (!fieldManifest.options) {
    return;
  }

  const allowedValues = new Set(fieldManifest.options.map((option) => option.code));
  if (values.some((value) => !allowedValues.has(value))) {
    throw roommateSearchErrors.invalidQuery(
      `${field} 필터에 현재 campus/scope에서 사용할 수 없는 값이 포함되어 있습니다.`,
    );
  }
}
