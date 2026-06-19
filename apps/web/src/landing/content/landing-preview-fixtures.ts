import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';

export interface LandingProfilePreviewItem extends RoommateSearchSummary {
  displayDormitoryLabel: string;
  avatarBg: `bg-${string}`;
  avatarText: `text-${string}`;
}

const actionableSummaryDefaults = {
  sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
  relation: { type: 'GENERAL' },
  exposure: {
    listSummaryVisible: true,
    detailViewable: true,
    canViewFull: true,
    scoreVisible: true,
  },
  actions: {
    canBookmark: true,
    canRequestMatch: true,
    canStartChat: true,
    unavailableReasons: [],
  },
  resultRead: {
    resultReadable: false,
    context: 'NONE',
  },
} as const satisfies Pick<
  RoommateSearchSummary,
  'sourceProfile' | 'relation' | 'exposure' | 'actions' | 'resultRead'
>;

export const landingProfilePreviewItems = [
  {
    ...actionableSummaryDefaults,
    id: 'daon-quiet-day-preview',
    displayDormitoryLabel: '다온관 (남)',
    matchScore: 95,
    profileSummary: {
      nickname: '조용한하루',
      intro: '아침 수업이 많아 밤에는 조용히 쉬는 편이에요. 이어폰 사용과 요일별 청소를 선호해요.',
      smokingBehavior: 'NO',
      sleepHabit: 'NONE',
      relationshipStyle: 'CASUAL',
    },
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-600',
  },
  {
    ...actionableSummaryDefaults,
    id: 'saerom-clean-routine-preview',
    displayDormitoryLabel: '새롬관 (여)',
    matchScore: 88,
    profileSummary: {
      nickname: '정리좋아',
      intro:
        '평일엔 도서관에서 공부하고 방은 정리된 상태를 유지하려고 해요. 생활 리듬을 존중하며 편하게 이야기하고 싶어요.',
      smokingBehavior: 'NO',
      sleepHabit: 'NONE',
      relationshipStyle: 'CLOSE',
    },
    avatarBg: 'bg-cyan-100',
    avatarText: 'text-cyan-600',
  },
] as const satisfies readonly LandingProfilePreviewItem[];
