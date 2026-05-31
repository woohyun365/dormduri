import { LIFESTYLE_FIELD_OPTIONS } from '@repo/shared/lifestyle';
import { PROFILE_GRADE_VALUES } from '@repo/shared/profile-contract';
import type {
  RoommateSearchManifest,
  RoommateSearchPurpose,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search-contract';
import { ROOMMATE_SEARCH_MIN_SCORE_PRESETS } from '@repo/shared/roommate-search-contract';
import type { VisibleProfileViewerContext } from './visible-profile-owner.js';

const FILTER_POLICY_VERSION = 'roommate-search-filter-manifest-v1';
const AGE_BAND_OPTIONS = ['19', '20', '21', '22', '23', '24', '25_PLUS'] as const;
const MBTI_TRAIT_OPTIONS = ['E', 'I', 'N', 'S', 'T', 'F', 'J', 'P'] as const;

export interface RoommateSearchCollegeOption {
  code: string;
  label: string;
}

export function buildRoommateSearchManifest(input: {
  viewerContext: VisibleProfileViewerContext;
  scope: RoommateSearchScope;
  purpose: RoommateSearchPurpose;
  appliedSort: RoommateSearchSort;
  activeCollegeOptions: RoommateSearchCollegeOption[];
}): RoommateSearchManifest {
  const filtersEnabled = input.purpose === 'ACTIONABLE_DETAIL_DISCOVERY';

  return {
    manifestRevision: buildManifestRevision(input),
    scope: input.scope,
    purpose: input.purpose,
    filters: filtersEnabled
      ? {
          enabled: true,
          fields: buildEnabledFilterFields(input),
        }
      : {
          enabled: false,
          fields: {},
        },
    sorts: buildSortManifest(input.appliedSort, filtersEnabled),
  };
}

function buildManifestRevision(input: {
  viewerContext: VisibleProfileViewerContext;
  scope: RoommateSearchScope;
  purpose: RoommateSearchPurpose;
  activeCollegeOptions: RoommateSearchCollegeOption[];
}) {
  const activeCollegeCodes = input.activeCollegeOptions.map((item) => item.code);
  return [
    FILTER_POLICY_VERSION,
    input.viewerContext.viewer.campus,
    input.viewerContext.serviceState.seasonState ?? 'NO_SEASON',
    input.scope,
    input.purpose,
    input.viewerContext.seasonReferenceYear ?? 'NO_REFERENCE_YEAR',
    activeCollegeCodes.join('.'),
  ].join(':');
}

function buildEnabledFilterFields(input: {
  activeCollegeOptions: RoommateSearchCollegeOption[];
}): RoommateSearchManifest['filters']['fields'] {
  return {
    smokingBehavior: enumField(LIFESTYLE_FIELD_OPTIONS.smokingBehavior),
    bedtime: enumField(LIFESTYLE_FIELD_OPTIONS.bedtime),
    wakeTime: enumField(LIFESTYLE_FIELD_OPTIONS.wakeTime),
    noiseSensitivity: enumField(LIFESTYLE_FIELD_OPTIONS.noiseSensitivity),
    cleanLevel: enumField(LIFESTYLE_FIELD_OPTIONS.cleanLevel),
    sleepHabit: enumField([...LIFESTYLE_FIELD_OPTIONS.sleepHabit, 'HAS'] as const),
    indoorEating: enumField(LIFESTYLE_FIELD_OPTIONS.indoorEating),
    relationshipStyle: enumField(LIFESTYLE_FIELD_OPTIONS.relationshipStyle),
    college: {
      enabled: true,
      source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
      operators: ['INCLUDE', 'EXCLUDE'],
      options: input.activeCollegeOptions,
    },
    grade: {
      enabled: true,
      source: 'PROFILE_ENUM',
      operators: ['INCLUDE'],
      options: PROFILE_GRADE_VALUES.map((value) => ({ code: value, label: value })),
    },
    mbtiTraits: {
      enabled: true,
      source: 'MBTI_TRAITS',
      options: MBTI_TRAIT_OPTIONS.map((value) => ({ code: value, label: value })),
    },
    ageBand: {
      enabled: true,
      source: 'AGE_BAND',
      options: AGE_BAND_OPTIONS.map((value) => ({
        code: value,
        label: value === '25_PLUS' ? '25세 이상' : `${value}세`,
      })),
    },
    minScore: {
      enabled: true,
      source: 'MATCH_SCORE_PRESET',
      options: ROOMMATE_SEARCH_MIN_SCORE_PRESETS.map((value) => ({
        code: String(value),
        label: `${value}점 이상`,
      })),
    },
  };
}

function enumField(values: readonly string[]) {
  return {
    enabled: true,
    source: 'LIFESTYLE_FIELD_OPTIONS' as const,
    options: values.map((value) => ({ code: value, label: value })),
  };
}

function buildSortManifest(
  appliedSort: RoommateSearchSort,
  scoreSortEnabled: boolean,
): RoommateSearchManifest['sorts'] {
  return {
    default: scoreSortEnabled ? 'MATCH_SCORE' : appliedSort,
    options: scoreSortEnabled ? ['NICKNAME', 'MATCH_SCORE'] : ['NICKNAME'],
  };
}
