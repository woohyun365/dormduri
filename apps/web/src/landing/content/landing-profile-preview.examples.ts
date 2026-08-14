import type { RoommateSearchProfileSummary } from '@repo/shared/roommate-search/contract';

export interface LandingProfilePreviewItem {
  readonly id: string;
  readonly displayDormitoryLabel: string;
  readonly matchScore: number;
  readonly profileSummary: RoommateSearchProfileSummary;
  readonly avatarClassName: string;
}

export const landingHeroProfilePreview = {
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
  avatarClassName: 'bg-emerald-100 text-emerald-600',
} as const satisfies LandingProfilePreviewItem;
