import {
  formatLifestyleFieldName,
  formatLifestyleOptionLabel,
} from '@/main/model/lifestyleDisplayCopy';
import { formatGradeLabel } from '@/main/model/profileDisplayCopy';
import type { LifestyleData } from '@/types/lifestyle';
import type { SeasonProfileDraftResponse } from '@repo/shared/season/participation';

const SEASON_PROFILE_LIFESTYLE_FIELDS: (keyof LifestyleData)[] = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'screenUsage',
  'noiseSensitivity',
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'relationshipStyle',
  'temperatureSensitivity',
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'screenTolerance',
  'indoorEatingTolerance',
  'cleanExpectation',
];

export interface HomeProfileDisplayRow {
  label: string;
  value: string;
}

export function buildSeasonProfileStatusRows(
  profile: SeasonProfileDraftResponse,
): HomeProfileDisplayRow[] {
  return [
    { label: '프로필 상태', value: formatProfileState(profile.state) },
    {
      label: '작성 상태',
      value: profile.completion.profileCompletionRequired ? '보완 필요' : '완료',
    },
    {
      label: '기숙사 설정',
      value: profile.completion.dormitorySelectionRequired ? '설정 필요' : '완료',
    },
    { label: '수정 가능', value: profile.draftWritable ? '가능' : '읽기 전용' },
    { label: '학년', value: formatGradeLabel(profile.additional.grade) },
    { label: 'MBTI', value: profile.additional.mbti ?? '미입력' },
  ];
}

export function buildSeasonProfileLifestyleRows(
  profile: SeasonProfileDraftResponse,
): HomeProfileDisplayRow[] {
  return SEASON_PROFILE_LIFESTYLE_FIELDS.map((field) => ({
    label: formatLifestyleFieldName(field),
    value: formatLifestyleOptionLabel(field, profile.lifestyle[field]),
  }));
}

export function formatSeasonProfileIntro(profile: SeasonProfileDraftResponse): string {
  return profile.intro.trim() || '아직 소개 문구가 없어요.';
}

function formatProfileState(state: SeasonProfileDraftResponse['state']): string {
  return state === 'REGISTRATION_FINALIZED' ? '시즌 참여 완료' : '작성 중';
}
