import { CAMPUS_NAMES } from '@/constants/dormitory';
import { getCollegeLabel, GRADES } from '@/constants/additional-profile';
import { getLifestyleLabel, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';
import type { PublicProfile, PublicProfileFullDetail } from '@repo/shared/profile/contract';
import type { HomeProfileDisplayRow } from './seasonProfileDisplay.mapper';

const PUBLIC_PROFILE_LIFESTYLE_FIELDS: (keyof PublicProfileFullDetail['lifestyle'])[] = [
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
];

export function buildPublicProfileIdentityRows(profile: PublicProfile): HomeProfileDisplayRow[] {
  if (profile.detailState === 'TOMBSTONE') {
    return [
      { label: '표시 이름', value: profile.tombstone.displayName },
      { label: '상태', value: '상세 정보 제한' },
    ];
  }

  return [
    { label: '닉네임', value: profile.nickname },
    { label: '성별', value: profile.gender === 'M' ? '남' : '여' },
    { label: '캠퍼스', value: CAMPUS_NAMES[profile.campus] },
    { label: '단과대', value: getCollegeLabel(profile.additional.college) ?? '미입력' },
    {
      label: '학년',
      value: GRADES.find((grade) => grade.value === profile.additional.grade)?.label ?? '미입력',
    },
    { label: 'MBTI', value: profile.additional.mbti ?? '미입력' },
    ...(typeof profile.matchScore === 'number'
      ? [{ label: '매칭도', value: `${profile.matchScore}%` }]
      : []),
  ];
}

export function buildPublicProfileLifestyleRows(profile: PublicProfile): HomeProfileDisplayRow[] {
  if (profile.detailState === 'TOMBSTONE') return [];

  return PUBLIC_PROFILE_LIFESTYLE_FIELDS.map((field) => ({
    label: LIFESTYLE_FIELD_NAMES[field as keyof LifestyleData],
    value: getLifestyleLabel(field as keyof LifestyleData, profile.lifestyle[field]),
  }));
}

export function resolvePublicProfileTitle(
  profile: PublicProfile,
  fallbackNickname: string,
): string {
  if (profile.detailState === 'TOMBSTONE') return profile.tombstone.displayName || fallbackNickname;
  return profile.nickname;
}

export function resolvePublicProfileIntro(profile: PublicProfile): string {
  if (profile.detailState === 'TOMBSTONE') return profile.tombstone.message;
  return profile.intro.trim() || '아직 소개 문구가 없어요.';
}
