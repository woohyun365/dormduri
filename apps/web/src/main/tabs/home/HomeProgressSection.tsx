import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { getChecklistItems, isChecklistComplete } from '@/utils/onboarding';
import { OnboardingChecklist } from '../../components/OnboardingChecklist';
import type { ChecklistNavigateTo } from '@/utils/onboarding';
import type { TabId, UserProfile } from '@/types/profile';

interface HomeProgressSectionProps {
  user: UserProfile;
  bookmarkedUserIds: Set<string>;
  isChecklistDismissed?: boolean;
  forceShowChecklist?: boolean;
  onDismissChecklist?: () => void;
  onNavigate: (tab: TabId) => void;
  onOpenBuildingSelect?: () => void;
}

export function HomeProgressSection({
  user,
  bookmarkedUserIds,
  isChecklistDismissed,
  forceShowChecklist,
  onDismissChecklist,
  onNavigate,
  onOpenBuildingSelect,
}: HomeProgressSectionProps) {
  const checklistItems = useMemo(
    () => getChecklistItems(user, bookmarkedUserIds),
    [user, bookmarkedUserIds],
  );
  const checklistComplete = isChecklistComplete(user, bookmarkedUserIds);
  const showChecklist = forceShowChecklist || (!checklistComplete && !isChecklistDismissed);

  const {
    percent: completionPercent,
    filledOptional,
    totalOptional,
    isComplete: hasAllOptional,
  } = getProfileCompletion(user);

  const handleChecklistNavigate = (target: ChecklistNavigateTo) => {
    switch (target) {
      case 'building':
        onOpenBuildingSelect?.();
        break;
      case 'profile':
        onNavigate('profile');
        break;
      case 'list':
        onNavigate('list');
        break;
    }
  };

  if (showChecklist) {
    return (
      <OnboardingChecklist
        items={checklistItems}
        onNavigate={handleChecklistNavigate}
        onDismiss={() => onDismissChecklist?.()}
      />
    );
  }

  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">프로필 완성도</h2>
      <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
            {completionPercent}%
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              hasAllOptional ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}
          >
            {hasAllOptional ? '완성' : `${filledOptional}/${totalOptional} 선택 항목`}
          </span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[var(--knu-primary)] transition-all duration-300 rounded-full"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        {hasAllOptional ? (
          <p className="text-sm text-green-600 font-semibold">모든 항목이 입력되었어요!</p>
        ) : (
          <div>
            <p className="text-xs text-[var(--knu-text-tertiary)] mb-2">미작성 항목</p>
            <div className="flex flex-wrap gap-1.5">
              {!user.messageToRoommate && (
                <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                  룸메에게 한마디
                </span>
              )}
              {!user.additional.college && (
                <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                  단대
                </span>
              )}
              {!user.additional.grade && (
                <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                  학년
                </span>
              )}
              {!user.additional.mbti && (
                <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                  MBTI
                </span>
              )}
              {!user.additional.temperatureSensitivity && (
                <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                  온도 민감도
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('profile')}
              className="mt-3 flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
            >
              프로필 완성하기
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
