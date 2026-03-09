import { isDormitoryAssigned } from '@/utils/dormitory';
import type { UserProfile } from '@/types/profile';

export type ChecklistNavigateTo = 'building' | 'profile' | 'list';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  navigateTo: ChecklistNavigateTo;
}

export function getChecklistItems(
  user: UserProfile,
  bookmarkedUserIds: Set<string>,
): ChecklistItem[] {
  return [
    {
      id: 'building',
      label: '건물 선택하기',
      completed: isDormitoryAssigned(user.dormitoryId),
      navigateTo: 'building',
    },
    {
      id: 'lifestyle',
      label: '생활패턴 입력하기',
      completed: Object.values(user.lifestyle).every((v) => v !== null),
      navigateTo: 'profile',
    },
    {
      id: 'intro',
      label: '자기소개 작성하기',
      completed: user.intro.length > 0,
      navigateTo: 'profile',
    },
    {
      id: 'bookmark',
      label: '첫 룸메이트 찜하기',
      completed: bookmarkedUserIds.size > 0,
      navigateTo: 'list',
    },
  ];
}

export function isChecklistComplete(user: UserProfile, bookmarkedUserIds: Set<string>): boolean {
  return getChecklistItems(user, bookmarkedUserIds).every((item) => item.completed);
}
