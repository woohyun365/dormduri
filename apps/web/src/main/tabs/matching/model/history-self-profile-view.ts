import {
  formatLifestyleFieldName,
  formatLifestyleOptionLabel,
} from '@/main/model/lifestyleDisplayCopy';
import { formatGradeLabel } from '@/main/model/profileDisplayCopy';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { PreviousSeasonProfileFull } from '@repo/shared/season/participation';

const LIFESTYLE_FIELDS = [
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
] as const satisfies readonly (keyof LifestyleData)[];

const PREFERENCE_FIELDS = [
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'screenTolerance',
  'indoorEatingTolerance',
  'cleanExpectation',
] as const satisfies readonly (keyof LifestyleData)[];

export interface HistorySelfProfileRow {
  readonly label: string;
  readonly value: string;
}

export function buildHistorySelfProfileIdentityRows(
  profile: PreviousSeasonProfileFull,
): readonly HistorySelfProfileRow[] {
  return [
    { label: '기숙사', value: profile.dormitoryName ?? '기숙사 정보 없음' },
    { label: '학년', value: formatGradeLabel(profile.additional.grade) },
    { label: 'MBTI', value: profile.additional.mbti ?? '미입력' },
    { label: '등록 상태', value: '시즌 참여 완료' },
  ];
}

export function buildHistorySelfProfileLifestyleRows(
  profile: PreviousSeasonProfileFull,
): readonly HistorySelfProfileRow[] {
  return toRows(profile, LIFESTYLE_FIELDS);
}

export function buildHistorySelfProfilePreferenceRows(
  profile: PreviousSeasonProfileFull,
): readonly HistorySelfProfileRow[] {
  return toRows(profile, PREFERENCE_FIELDS);
}

export function formatHistorySelfProfileIntro(profile: PreviousSeasonProfileFull): string {
  return profile.intro.trim() || '이 시즌에 작성한 소개 문구가 없어요.';
}

export function formatHistorySelfProfileSnapshotDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '저장 시점 정보 없음';
  return `${new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)} 저장`;
}

function toRows(
  profile: PreviousSeasonProfileFull,
  fields: readonly (keyof LifestyleData)[],
): readonly HistorySelfProfileRow[] {
  return fields.map((field) => ({
    label: formatLifestyleFieldName(field),
    value: formatLifestyleOptionLabel(field, profile.lifestyle[field]),
  }));
}
