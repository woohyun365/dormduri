import type { DormitoryGuideResponse } from '@repo/shared/dormitory';

const BATHROOM_LABEL = {
  SHARED: '공동 화장실/세면실',
  PRIVATE: '호실 내 화장실/샤워실',
} as const;

export function buildDormitoryGuidePresentation(response: DormitoryGuideResponse) {
  return {
    ...response,
    bathroomLabel: BATHROOM_LABEL[response.guide.bathroomType],
  };
}
