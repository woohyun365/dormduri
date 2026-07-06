import type {
  RoommateSearchAgeBand,
  RoommateSearchFilterOperator,
  RoommateSearchMinScorePreset,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';

export const ROOMMATE_SEARCH_DEFAULT_SCOPE = 'CAMPUS_MERGED' satisfies RoommateSearchScope;
export const ROOMMATE_SEARCH_DEFAULT_SORT = 'NICKNAME' satisfies RoommateSearchSort;

export const ROOMMATE_SEARCH_SCALAR_FILTER_KEYS = [
  'smokingBehavior',
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanLevel',
  'sleepHabit',
  'indoorEating',
  'relationshipStyle',
] as const;

export const ROOMMATE_SEARCH_GROUP_FILTER_KEYS = [
  'college',
  'grade',
  'mbtiTraits',
  'ageBand',
  'minScore',
] as const;

export const ROOMMATE_SEARCH_FILTER_KEYS = [
  ...ROOMMATE_SEARCH_SCALAR_FILTER_KEYS,
  ...ROOMMATE_SEARCH_GROUP_FILTER_KEYS,
] as const;

export const ROOMMATE_SEARCH_MBTI_TRAIT_KEYS = [
  'energy',
  'perception',
  'decision',
  'lifestyle',
] as const;

export type RoommateSearchScalarFilterKey = (typeof ROOMMATE_SEARCH_SCALAR_FILTER_KEYS)[number];
export type RoommateSearchGroupFilterKey = (typeof ROOMMATE_SEARCH_GROUP_FILTER_KEYS)[number];
export type RoommateSearchCriteriaFilterKey = (typeof ROOMMATE_SEARCH_FILTER_KEYS)[number];
export type RoommateSearchMbtiTraitKey = (typeof ROOMMATE_SEARCH_MBTI_TRAIT_KEYS)[number];

export interface RoommateSearchOperatorValuesCriteria {
  operator: RoommateSearchFilterOperator;
  values: readonly string[];
}

export interface RoommateSearchAgeBandCriteria {
  values: readonly RoommateSearchAgeBand[];
}

export type RoommateSearchMbtiTraitCriteria = Partial<
  Record<RoommateSearchMbtiTraitKey, string | null | undefined>
>;

export type RoommateSearchScalarFilters = Partial<
  Record<RoommateSearchScalarFilterKey, string | null | undefined>
>;

export interface RoommateSearchFilterCriteria extends RoommateSearchScalarFilters {
  college?: RoommateSearchOperatorValuesCriteria | null;
  grade?: RoommateSearchOperatorValuesCriteria | null;
  mbtiTraits?: RoommateSearchMbtiTraitCriteria | null;
  ageBand?: RoommateSearchAgeBandCriteria | null;
  minScore?: RoommateSearchMinScorePreset | null;
}

export interface RoommateSearchQueryCriteria {
  readonly scope: RoommateSearchScope;
  readonly sort: RoommateSearchSort;
  readonly filters: RoommateSearchFilterCriteria;
}

export interface BuildRoommateSearchQueryParamsOptions {
  readonly cursor?: string | null;
  readonly limit?: number | null;
}

export function createDefaultRoommateSearchQueryCriteria(
  overrides: Partial<RoommateSearchQueryCriteria> = {},
): RoommateSearchQueryCriteria {
  return {
    scope: overrides.scope ?? ROOMMATE_SEARCH_DEFAULT_SCOPE,
    sort: overrides.sort ?? ROOMMATE_SEARCH_DEFAULT_SORT,
    filters: { ...(overrides.filters ?? {}) },
  };
}

export function buildRoommateSearchQueryParams(
  query: RoommateSearchQueryCriteria,
  options: BuildRoommateSearchQueryParamsOptions = {},
): URLSearchParams {
  const params = new URLSearchParams();

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (typeof options.cursor === 'string' && options.cursor.trim() !== '') {
    params.set('cursor', options.cursor);
  }

  params.set('scope', query.scope);
  params.set('sort', query.sort);

  for (const key of ROOMMATE_SEARCH_SCALAR_FILTER_KEYS) {
    appendNonEmptyString(params, key, query.filters[key]);
  }

  appendOperatorValues(params, 'college', query.filters.college);
  appendOperatorValues(params, 'grade', query.filters.grade);
  appendMbtiTraits(params, query.filters.mbtiTraits);
  appendAgeBands(params, query.filters.ageBand);

  if (query.filters.minScore !== undefined && query.filters.minScore !== null) {
    params.set('minScore', String(query.filters.minScore));
  }

  return params;
}

export function cloneRoommateSearchQueryCriteria(
  query: RoommateSearchQueryCriteria,
): RoommateSearchQueryCriteria {
  return {
    scope: query.scope,
    sort: query.sort,
    filters: cloneRoommateSearchFilterCriteria(query.filters),
  };
}

export function cloneRoommateSearchFilterCriteria(
  filters: RoommateSearchFilterCriteria,
): RoommateSearchFilterCriteria {
  return {
    ...copyScalarFilters(filters),
    college: cloneOperatorValues(filters.college),
    grade: cloneOperatorValues(filters.grade),
    mbtiTraits: filters.mbtiTraits ? { ...filters.mbtiTraits } : null,
    ageBand: filters.ageBand ? { values: [...filters.ageBand.values] } : null,
    minScore: filters.minScore ?? null,
  };
}

export function withoutRoommateSearchFilterCriteriaKey(
  filters: RoommateSearchFilterCriteria,
  key: RoommateSearchCriteriaFilterKey,
): RoommateSearchFilterCriteria {
  const next = cloneRoommateSearchFilterCriteria(filters);
  delete next[key];
  return compactRoommateSearchFilterCriteria(next);
}

export function compactRoommateSearchFilterCriteria(
  filters: RoommateSearchFilterCriteria,
): RoommateSearchFilterCriteria {
  const next: RoommateSearchFilterCriteria = {};

  for (const key of ROOMMATE_SEARCH_SCALAR_FILTER_KEYS) {
    const value = filters[key];
    if (typeof value === 'string' && value.trim() !== '') {
      next[key] = value;
    }
  }

  const college = compactOperatorValues(filters.college);
  if (college) next.college = college;

  const grade = compactOperatorValues(filters.grade);
  if (grade) next.grade = grade;

  const mbtiTraits = compactMbtiTraits(filters.mbtiTraits);
  if (mbtiTraits) next.mbtiTraits = mbtiTraits;

  const ageBand = compactAgeBand(filters.ageBand);
  if (ageBand) next.ageBand = ageBand;

  if (filters.minScore !== undefined && filters.minScore !== null) {
    next.minScore = filters.minScore;
  }

  return next;
}

function appendNonEmptyString(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
): void {
  if (typeof value === 'string' && value.trim() !== '') {
    params.set(key, value);
  }
}

function appendOperatorValues(
  params: URLSearchParams,
  prefix: 'college' | 'grade',
  criteria: RoommateSearchOperatorValuesCriteria | null | undefined,
): void {
  const compacted = compactOperatorValues(criteria);
  if (!compacted) return;

  params.set(`${prefix}.operator`, compacted.operator);
  for (const value of compacted.values) {
    params.append(`${prefix}.values[]`, value);
  }
}

function appendMbtiTraits(
  params: URLSearchParams,
  criteria: RoommateSearchMbtiTraitCriteria | null | undefined,
): void {
  if (!criteria) return;

  for (const key of ROOMMATE_SEARCH_MBTI_TRAIT_KEYS) {
    appendNonEmptyString(params, `mbtiTraits.${key}`, criteria[key]);
  }
}

function appendAgeBands(
  params: URLSearchParams,
  criteria: RoommateSearchAgeBandCriteria | null | undefined,
): void {
  const compacted = compactAgeBand(criteria);
  if (!compacted) return;

  for (const value of compacted.values) {
    params.append('ageBand.values[]', value);
  }
}

function copyScalarFilters(filters: RoommateSearchFilterCriteria): RoommateSearchScalarFilters {
  const next: RoommateSearchScalarFilters = {};
  for (const key of ROOMMATE_SEARCH_SCALAR_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

function cloneOperatorValues(
  criteria: RoommateSearchOperatorValuesCriteria | null | undefined,
): RoommateSearchOperatorValuesCriteria | null {
  return criteria ? { operator: criteria.operator, values: [...criteria.values] } : null;
}

function compactOperatorValues(
  criteria: RoommateSearchOperatorValuesCriteria | null | undefined,
): RoommateSearchOperatorValuesCriteria | null {
  if (!criteria) return null;
  const values = criteria.values.filter((value) => value.trim() !== '');
  return values.length > 0 ? { operator: criteria.operator, values } : null;
}

function compactMbtiTraits(
  criteria: RoommateSearchMbtiTraitCriteria | null | undefined,
): RoommateSearchMbtiTraitCriteria | null {
  if (!criteria) return null;
  const next: RoommateSearchMbtiTraitCriteria = {};
  for (const key of ROOMMATE_SEARCH_MBTI_TRAIT_KEYS) {
    const value = criteria[key];
    if (typeof value === 'string' && value.trim() !== '') {
      next[key] = value;
    }
  }
  return Object.keys(next).length > 0 ? next : null;
}

function compactAgeBand(
  criteria: RoommateSearchAgeBandCriteria | null | undefined,
): RoommateSearchAgeBandCriteria | null {
  if (!criteria) return null;
  const values = criteria.values.filter((value) => value.trim() !== '');
  return values.length > 0 ? { values } : null;
}
