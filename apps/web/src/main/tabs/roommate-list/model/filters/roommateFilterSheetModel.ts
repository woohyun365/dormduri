import type {
  RoommateSearchFilterOperator,
  RoommateSearchMinScorePreset,
} from '@repo/shared/roommate-search/contract';
import {
  buildRoommateSearchActiveFilterChips,
  sanitizeRoommateSearchQueryForManifest,
  type RoommateSearchActiveFilterChipModel,
  type RoommateSearchFilterFieldModel,
  type RoommateSearchManifestModel,
} from './roommateSearchManifestModel';
import {
  cloneRoommateSearchFilterCriteria,
  compactRoommateSearchFilterCriteria,
  ROOMMATE_SEARCH_FILTER_KEYS,
  ROOMMATE_SEARCH_GROUP_FILTER_KEYS,
  ROOMMATE_SEARCH_MBTI_TRAIT_KEYS,
  ROOMMATE_SEARCH_SCALAR_FILTER_KEYS,
  type RoommateSearchCriteriaFilterKey,
  type RoommateSearchFilterCriteria,
  type RoommateSearchGroupFilterKey,
  type RoommateSearchMbtiTraitKey,
  type RoommateSearchQueryCriteria,
  type RoommateSearchScalarFilterKey,
} from '../search/roommateSearchQuery';

export type RoommateFilterDraft = RoommateSearchFilterCriteria;

export type RoommateFilterFieldKind =
  | 'single'
  | 'operator-values'
  | 'mbti-traits'
  | 'multi-values'
  | 'score-preset';

export interface RoommateFilterOptionViewModel {
  readonly code: string;
  readonly label: string;
  readonly selected: boolean;
}

export interface RoommateFilterFieldViewModel {
  readonly key: RoommateSearchCriteriaFilterKey;
  readonly label: string;
  readonly kind: RoommateFilterFieldKind;
  readonly operators: readonly RoommateSearchFilterOperator[];
  readonly selectedOperator: RoommateSearchFilterOperator | null;
  readonly options: readonly RoommateFilterOptionViewModel[];
  readonly disabledReason: string | null;
}

export interface RoommateFilterSheetViewModel {
  readonly canOpen: boolean;
  readonly policyCopy: string | null;
  readonly fields: readonly RoommateFilterFieldViewModel[];
  readonly activeChips: readonly RoommateSearchActiveFilterChipModel[];
}

const FILTER_CLOSED_COPY = '현재 시즌 정책상 상세 필터는 열리지 않아요.';

export function createRoommateFilterDraft(
  filters: RoommateSearchFilterCriteria,
): RoommateFilterDraft {
  return cloneRoommateSearchFilterCriteria(filters);
}

export function buildRoommateFilterSheetViewModel(
  manifest: RoommateSearchManifestModel | null,
  query: RoommateSearchQueryCriteria,
  draft: RoommateFilterDraft = query.filters,
): RoommateFilterSheetViewModel {
  if (!manifest || !manifest.canOpenFilterSheet) {
    return {
      canOpen: false,
      policyCopy: FILTER_CLOSED_COPY,
      fields: [],
      activeChips: [],
    };
  }

  const compactDraft = compactRoommateFilterDraft(draft, manifest);

  return {
    canOpen: true,
    policyCopy: null,
    fields: manifest.enabledFilterKeys.map((key) =>
      buildFieldViewModel(key, manifest, compactDraft),
    ),
    activeChips: buildRoommateSearchActiveFilterChips(
      { ...query, filters: compactRoommateFilterDraft(query.filters, manifest) },
      manifest,
    ),
  };
}

export function compactRoommateFilterDraft(
  draft: RoommateFilterDraft,
  manifest: RoommateSearchManifestModel,
): RoommateSearchFilterCriteria {
  const sanitized = sanitizeRoommateSearchQueryForManifest(
    {
      scope: manifest.scope,
      sort: manifest.defaultSort,
      filters: compactRoommateSearchFilterCriteria(draft),
    },
    manifest,
  );
  return sanitized.query.filters;
}

export function setRoommateFilterDraftScalar(
  draft: RoommateFilterDraft,
  key: RoommateSearchScalarFilterKey,
  value: string | null,
): RoommateFilterDraft {
  const next = createRoommateFilterDraft(draft);
  if (!value || next[key] === value) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return compactRoommateSearchFilterCriteria(next);
}

export function setRoommateFilterDraftMinScore(
  draft: RoommateFilterDraft,
  value: RoommateSearchMinScorePreset | null,
): RoommateFilterDraft {
  const next = createRoommateFilterDraft(draft);
  if (!value || next.minScore === value) {
    delete next.minScore;
  } else {
    next.minScore = value;
  }
  return compactRoommateSearchFilterCriteria(next);
}

export function setRoommateFilterDraftOperator(
  draft: RoommateFilterDraft,
  key: 'college' | 'grade',
  operator: RoommateSearchFilterOperator,
): RoommateFilterDraft {
  const next = createRoommateFilterDraft(draft);
  const current = next[key];
  next[key] = {
    operator,
    values: current?.values ?? [],
  };
  return next;
}

export function toggleRoommateFilterDraftValue(
  draft: RoommateFilterDraft,
  key: 'college' | 'grade' | 'ageBand',
  value: string,
): RoommateFilterDraft {
  const next = createRoommateFilterDraft(draft);

  if (key === 'ageBand') {
    const currentValues = new Set(next.ageBand?.values ?? []);
    if (currentValues.has(value as never)) {
      currentValues.delete(value as never);
    } else {
      currentValues.add(value as never);
    }
    next.ageBand = { values: [...currentValues] as NonNullable<typeof next.ageBand>['values'] };
    return compactRoommateSearchFilterCriteria(next);
  }

  const current = next[key];
  const values = new Set(current?.values ?? []);
  if (values.has(value)) {
    values.delete(value);
  } else {
    values.add(value);
  }
  next[key] = {
    operator: current?.operator ?? 'INCLUDE',
    values: [...values],
  };
  return compactRoommateSearchFilterCriteria(next);
}

export function setRoommateFilterDraftMbtiTrait(
  draft: RoommateFilterDraft,
  trait: RoommateSearchMbtiTraitKey,
  value: string | null,
): RoommateFilterDraft {
  const next = createRoommateFilterDraft(draft);
  const mbtiTraits = { ...(next.mbtiTraits ?? {}) };
  if (!value || mbtiTraits[trait] === value) {
    delete mbtiTraits[trait];
  } else {
    mbtiTraits[trait] = value;
  }
  next.mbtiTraits = mbtiTraits;
  return compactRoommateSearchFilterCriteria(next);
}

function buildFieldViewModel(
  key: RoommateSearchCriteriaFilterKey,
  manifest: RoommateSearchManifestModel,
  draft: RoommateFilterDraft,
): RoommateFilterFieldViewModel {
  const field = manifest.fields[key];
  const kind = fieldKind(key);

  return {
    key,
    label: filterFieldLabel(key),
    kind,
    operators: field?.operators ?? [],
    selectedOperator: selectedOperator(key, field, draft),
    options: buildOptions(key, field, draft),
    disabledReason: field?.disabledReason ?? null,
  };
}

function buildOptions(
  key: RoommateSearchCriteriaFilterKey,
  field: RoommateSearchFilterFieldModel | undefined,
  draft: RoommateFilterDraft,
): readonly RoommateFilterOptionViewModel[] {
  return (field?.options ?? []).map((option) => ({
    code: option.code,
    label: option.label,
    selected: optionSelected(key, option.code, draft),
  }));
}

function optionSelected(
  key: RoommateSearchCriteriaFilterKey,
  code: string,
  draft: RoommateFilterDraft,
): boolean {
  if (isScalarKey(key)) {
    return draft[key] === code;
  }
  if (key === 'college' || key === 'grade') {
    return draft[key]?.values.includes(code) === true;
  }
  if (key === 'ageBand') {
    return draft.ageBand?.values.includes(code as never) === true;
  }
  if (key === 'mbtiTraits') {
    return ROOMMATE_SEARCH_MBTI_TRAIT_KEYS.some((trait) => draft.mbtiTraits?.[trait] === code);
  }
  return String(draft.minScore ?? '') === code;
}

function selectedOperator(
  key: RoommateSearchCriteriaFilterKey,
  field: RoommateSearchFilterFieldModel | undefined,
  draft: RoommateFilterDraft,
): RoommateSearchFilterOperator | null {
  if (key !== 'college' && key !== 'grade') return null;
  return draft[key]?.operator ?? field?.operators[0] ?? 'INCLUDE';
}

function fieldKind(key: RoommateSearchCriteriaFilterKey): RoommateFilterFieldKind {
  if (isScalarKey(key)) return 'single';
  if (key === 'college' || key === 'grade') return 'operator-values';
  if (key === 'mbtiTraits') return 'mbti-traits';
  if (key === 'ageBand') return 'multi-values';
  return 'score-preset';
}

function isScalarKey(key: RoommateSearchCriteriaFilterKey): key is RoommateSearchScalarFilterKey {
  return ROOMMATE_SEARCH_SCALAR_FILTER_KEYS.includes(key as RoommateSearchScalarFilterKey);
}

export function isRoommateSearchGroupFilterKey(
  key: RoommateSearchCriteriaFilterKey,
): key is RoommateSearchGroupFilterKey {
  return ROOMMATE_SEARCH_GROUP_FILTER_KEYS.includes(key as RoommateSearchGroupFilterKey);
}

export function filterFieldLabel(key: RoommateSearchCriteriaFilterKey): string {
  const labels: Record<RoommateSearchCriteriaFilterKey, string> = {
    smokingBehavior: '흡연',
    bedtime: '취침',
    wakeTime: '기상',
    noiseSensitivity: '소음 민감도',
    cleanLevel: '청소',
    sleepHabit: '잠버릇',
    indoorEating: '실내 취식',
    relationshipStyle: '관계 스타일',
    college: '단과대',
    grade: '학년',
    mbtiTraits: 'MBTI 성향',
    ageBand: '나이',
    minScore: '적합도',
  };
  return labels[key];
}

export const ROOMMATE_FILTER_SHEET_FIELD_ORDER = ROOMMATE_SEARCH_FILTER_KEYS;
