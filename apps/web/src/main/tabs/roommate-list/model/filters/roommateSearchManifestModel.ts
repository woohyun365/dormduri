import {
  formatRoommateSearchFilterOptionLabel,
  getRoommateSearchFilterFieldCopy,
} from './roommateSearchFilterCopy';
import type {
  RoommateSearchFilterOperator,
  RoommateSearchManifest,
  RoommateSearchPurpose,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';
import {
  ROOMMATE_SEARCH_FILTER_KEYS,
  ROOMMATE_SEARCH_MBTI_TRAIT_KEYS,
  ROOMMATE_SEARCH_SCALAR_FILTER_KEYS,
  compactRoommateSearchFilterCriteria,
  type RoommateSearchAgeBandCriteria,
  type RoommateSearchCriteriaFilterKey,
  type RoommateSearchFilterCriteria,
  type RoommateSearchMbtiTraitCriteria,
  type RoommateSearchOperatorValuesCriteria,
  type RoommateSearchQueryCriteria,
} from '../search/roommateSearchQuery';

const SCORE_SORT = 'MATCH_SCORE' satisfies RoommateSearchSort;
const STALE_QUERY_STATUS_MESSAGE = '검색 조건이 최신 룸메이트 찾기 정책에 맞게 조정됐어요.';
const GRADE_ORDER = ['1', '2', '3', '4+'] as const;
const AGE_BAND_ORDER = ['20', '21', '22', '23', '24', '25_PLUS'] as const;

export interface RoommateSearchFilterOptionModel {
  readonly code: string;
  readonly label: string;
}

export interface RoommateSearchFilterFieldModel {
  readonly key: RoommateSearchCriteriaFilterKey;
  readonly enabled: boolean;
  readonly operators: readonly RoommateSearchFilterOperator[];
  readonly options: readonly RoommateSearchFilterOptionModel[];
  readonly disabledReason: string | null;
}

export type RoommateSearchManifestFields = Partial<
  Record<RoommateSearchCriteriaFilterKey, RoommateSearchFilterFieldModel>
>;

export interface RoommateSearchManifestModel {
  readonly revision: string;
  readonly scope: RoommateSearchScope;
  readonly purpose: RoommateSearchPurpose;
  readonly filtersEnabled: boolean;
  readonly fields: RoommateSearchManifestFields;
  readonly defaultSort: RoommateSearchSort;
  readonly sortOptions: readonly RoommateSearchSort[];
  readonly enabledFilterKeys: readonly RoommateSearchCriteriaFilterKey[];
  readonly canOpenFilterSheet: boolean;
  readonly scoreSortEnabled: boolean;
}

export interface RoommateSearchActiveFilterChipModel {
  readonly key: RoommateSearchCriteriaFilterKey;
  readonly label: string;
  readonly valueLabel: string;
}

export interface RoommateSearchSanitizeResult {
  readonly query: RoommateSearchQueryCriteria;
  readonly removedFilterKeys: readonly RoommateSearchCriteriaFilterKey[];
  readonly sortChanged: boolean;
  readonly cursorShouldReset: boolean;
  readonly statusMessage: string | null;
}

export function mapRoommateSearchManifest(
  manifest: RoommateSearchManifest,
): RoommateSearchManifestModel {
  const fields = mapKnownFields(manifest);
  const enabledFilterKeys = ROOMMATE_SEARCH_FILTER_KEYS.filter((key) => fields[key]?.enabled);
  const filtersEnabled = manifest.filters.enabled && enabledFilterKeys.length > 0;
  const sortOptions =
    manifest.sorts.options.length > 0 ? manifest.sorts.options : [manifest.sorts.default];
  const defaultSort = sortOptions.includes(manifest.sorts.default)
    ? manifest.sorts.default
    : (sortOptions[0] ?? manifest.sorts.default);

  return {
    revision: manifest.manifestRevision,
    scope: manifest.scope,
    purpose: manifest.purpose,
    filtersEnabled,
    fields,
    defaultSort,
    sortOptions,
    enabledFilterKeys,
    canOpenFilterSheet: filtersEnabled,
    scoreSortEnabled: sortOptions.includes(SCORE_SORT),
  };
}

export function getRoommateSearchEnabledFilterKeys(
  manifest: RoommateSearchManifestModel,
): readonly RoommateSearchCriteriaFilterKey[] {
  return manifest.enabledFilterKeys;
}

export function canUseRoommateSearchFilterField(
  manifest: RoommateSearchManifestModel,
  key: RoommateSearchCriteriaFilterKey,
): boolean {
  return manifest.filtersEnabled && manifest.fields[key]?.enabled === true;
}

export function sanitizeRoommateSearchQueryForManifest(
  query: RoommateSearchQueryCriteria,
  manifest: RoommateSearchManifestModel,
): RoommateSearchSanitizeResult {
  const removed = new Set<RoommateSearchCriteriaFilterKey>();
  const sanitizedFilters = sanitizeFilters(query.filters, manifest, removed);
  const sort = sanitizeSort(query.sort, manifest, sanitizedFilters);
  const scopeChanged = query.scope !== manifest.scope;
  const sortChanged = sort !== query.sort;
  const compactedFilters = compactRoommateSearchFilterCriteria(sanitizedFilters);
  const removedFilterKeys = [...removed];
  const changed = scopeChanged || sortChanged || removedFilterKeys.length > 0;

  return {
    query: {
      scope: manifest.scope,
      sort,
      filters: compactedFilters,
    },
    removedFilterKeys,
    sortChanged,
    cursorShouldReset: changed,
    statusMessage: changed ? STALE_QUERY_STATUS_MESSAGE : null,
  };
}

export function buildRoommateSearchActiveFilterChips(
  query: RoommateSearchQueryCriteria,
  manifest: RoommateSearchManifestModel,
): readonly RoommateSearchActiveFilterChipModel[] {
  const chips: RoommateSearchActiveFilterChipModel[] = [];

  for (const key of ROOMMATE_SEARCH_SCALAR_FILTER_KEYS) {
    const value = query.filters[key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    const field = manifest.fields[key];
    chips.push({
      key,
      label: fieldLabel(key),
      valueLabel: optionLabel(key, field, value),
    });
  }

  appendOperatorValuesChip(chips, manifest, 'college', query.filters.college);
  appendOperatorValuesChip(chips, manifest, 'grade', query.filters.grade);

  if (query.filters.mbtiTraits) {
    const values = ROOMMATE_SEARCH_MBTI_TRAIT_KEYS.map((key) => {
      const value = query.filters.mbtiTraits?.[key];
      return typeof value === 'string' && value.trim() !== ''
        ? optionLabel('mbtiTraits', manifest.fields.mbtiTraits, value)
        : 'x';
    });
    if (values.some((value) => value !== 'x')) {
      chips.push({
        key: 'mbtiTraits',
        label: fieldLabel('mbtiTraits'),
        valueLabel: values.join('·'),
      });
    }
  }

  if (query.filters.ageBand?.values.length) {
    chips.push({
      key: 'ageBand',
      label: fieldLabel('ageBand'),
      valueLabel: sortValuesByKnownOrder(query.filters.ageBand.values, AGE_BAND_ORDER)
        .map((value) => optionLabel('ageBand', manifest.fields.ageBand, value))
        .join(', '),
    });
  }

  if (query.filters.minScore) {
    chips.push({
      key: 'minScore',
      label: fieldLabel('minScore'),
      valueLabel: optionLabel('minScore', manifest.fields.minScore, String(query.filters.minScore)),
    });
  }

  return chips;
}

function mapKnownFields(manifest: RoommateSearchManifest): RoommateSearchManifestFields {
  const fields: RoommateSearchManifestFields = {};
  for (const key of ROOMMATE_SEARCH_FILTER_KEYS) {
    const field = manifest.filters.fields[key];
    if (!field) continue;
    fields[key] = {
      key,
      enabled: manifest.filters.enabled && field.enabled,
      operators: field.operators ?? [],
      options: field.options ?? [],
      disabledReason: field.disabledReason ?? null,
    };
  }
  return fields;
}

function sanitizeSort(
  sort: RoommateSearchSort,
  manifest: RoommateSearchManifestModel,
  filters: RoommateSearchFilterCriteria,
): RoommateSearchSort {
  if (filters.minScore && manifest.scoreSortEnabled) {
    return SCORE_SORT;
  }
  return manifest.sortOptions.includes(sort) ? sort : manifest.defaultSort;
}

function sanitizeFilters(
  filters: RoommateSearchFilterCriteria,
  manifest: RoommateSearchManifestModel,
  removed: Set<RoommateSearchCriteriaFilterKey>,
): RoommateSearchFilterCriteria {
  if (!manifest.filtersEnabled) {
    for (const key of ROOMMATE_SEARCH_FILTER_KEYS) {
      if (hasFilterValue(filters, key)) removed.add(key);
    }
    return {};
  }

  const next: RoommateSearchFilterCriteria = {};

  for (const key of ROOMMATE_SEARCH_SCALAR_FILTER_KEYS) {
    const value = filters[key];
    if (!hasStringValue(value)) continue;
    if (!isFieldUsableWithValue(manifest, key, value)) {
      removed.add(key);
      continue;
    }
    next[key] = value;
  }

  next.college = sanitizeOperatorValues('college', filters.college, manifest, removed);
  next.grade = sanitizeOperatorValues('grade', filters.grade, manifest, removed);
  next.mbtiTraits = sanitizeMbtiTraits(filters.mbtiTraits, manifest, removed);
  next.ageBand = sanitizeAgeBand(filters.ageBand, manifest, removed);
  next.minScore = sanitizeMinScore(filters.minScore, manifest, removed);

  return next;
}

function sanitizeOperatorValues(
  key: 'college' | 'grade',
  criteria: RoommateSearchOperatorValuesCriteria | null | undefined,
  manifest: RoommateSearchManifestModel,
  removed: Set<RoommateSearchCriteriaFilterKey>,
): RoommateSearchOperatorValuesCriteria | null {
  if (!criteria) return null;
  const field = manifest.fields[key];
  if (!field?.enabled || !canUseOperator(field, criteria.operator)) {
    removed.add(key);
    return null;
  }

  const values = criteria.values.filter((value) => canUseOptionCode(field, value));
  if (values.length === 0) {
    removed.add(key);
    return null;
  }
  if (values.length !== criteria.values.length) {
    removed.add(key);
  }

  return { operator: criteria.operator, values };
}

function sanitizeMbtiTraits(
  criteria: RoommateSearchMbtiTraitCriteria | null | undefined,
  manifest: RoommateSearchManifestModel,
  removed: Set<RoommateSearchCriteriaFilterKey>,
): RoommateSearchMbtiTraitCriteria | null {
  if (!criteria) return null;
  const field = manifest.fields.mbtiTraits;
  if (!field?.enabled) {
    removed.add('mbtiTraits');
    return null;
  }

  const next: RoommateSearchMbtiTraitCriteria = {};
  for (const key of ROOMMATE_SEARCH_MBTI_TRAIT_KEYS) {
    const value = criteria[key];
    if (!hasStringValue(value)) continue;
    if (!canUseOptionCode(field, value)) {
      removed.add('mbtiTraits');
      continue;
    }
    next[key] = value;
  }

  return Object.keys(next).length > 0 ? next : null;
}

function sanitizeAgeBand(
  criteria: RoommateSearchAgeBandCriteria | null | undefined,
  manifest: RoommateSearchManifestModel,
  removed: Set<RoommateSearchCriteriaFilterKey>,
): RoommateSearchAgeBandCriteria | null {
  if (!criteria) return null;
  const field = manifest.fields.ageBand;
  if (!field?.enabled) {
    removed.add('ageBand');
    return null;
  }

  const values = criteria.values.filter((value) => canUseOptionCode(field, value));
  if (values.length === 0) {
    removed.add('ageBand');
    return null;
  }
  if (values.length !== criteria.values.length) {
    removed.add('ageBand');
  }

  return { values };
}

function sanitizeMinScore(
  value: RoommateSearchFilterCriteria['minScore'],
  manifest: RoommateSearchManifestModel,
  removed: Set<RoommateSearchCriteriaFilterKey>,
): RoommateSearchFilterCriteria['minScore'] {
  if (value === undefined || value === null) return null;
  const field = manifest.fields.minScore;
  if (!field?.enabled || !manifest.scoreSortEnabled || !canUseOptionCode(field, String(value))) {
    removed.add('minScore');
    return null;
  }
  return value;
}

function hasFilterValue(
  filters: RoommateSearchFilterCriteria,
  key: RoommateSearchCriteriaFilterKey,
): boolean {
  const value = filters[key];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return true;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

function hasStringValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isFieldUsableWithValue(
  manifest: RoommateSearchManifestModel,
  key: RoommateSearchCriteriaFilterKey,
  value: string,
): boolean {
  const field = manifest.fields[key];
  if (key === 'sleepHabit') {
    return field?.enabled === true && value === 'NONE' && canUseOptionCode(field, value);
  }
  return field?.enabled === true && canUseOptionCode(field, value);
}

function canUseOperator(
  field: RoommateSearchFilterFieldModel,
  operator: RoommateSearchFilterOperator,
): boolean {
  return field.operators.length === 0 || field.operators.includes(operator);
}

function canUseOptionCode(field: RoommateSearchFilterFieldModel, code: string): boolean {
  return field.options.length === 0 || field.options.some((option) => option.code === code);
}

function appendOperatorValuesChip(
  chips: RoommateSearchActiveFilterChipModel[],
  manifest: RoommateSearchManifestModel,
  key: 'college' | 'grade',
  criteria: RoommateSearchOperatorValuesCriteria | null | undefined,
): void {
  if (!criteria?.values.length) return;
  const field = manifest.fields[key];
  const values =
    key === 'grade' ? sortValuesByKnownOrder(criteria.values, GRADE_ORDER) : criteria.values;
  const valueLabel = values.map((value) => optionLabel(key, field, value)).join(', ');
  chips.push({
    key,
    label: fieldLabel(key),
    valueLabel:
      key === 'college' && criteria.operator === 'EXCLUDE' ? `${valueLabel} 제외` : valueLabel,
  });
}

function sortValuesByKnownOrder<T extends string>(
  values: readonly T[],
  order: readonly string[],
): T[] {
  const orderIndex = new Map(order.map((value, index) => [value, index]));
  return [...values].sort(
    (left, right) =>
      (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

function fieldLabel(key: RoommateSearchCriteriaFilterKey): string {
  return getRoommateSearchFilterFieldCopy(key).chipLabel;
}

function optionLabel(
  key: RoommateSearchCriteriaFilterKey,
  field: RoommateSearchFilterFieldModel | undefined,
  code: string,
): string {
  const manifestLabel = field?.options.find((option) => option.code === code)?.label ?? code;
  return formatRoommateSearchFilterOptionLabel(key, code, manifestLabel);
}
