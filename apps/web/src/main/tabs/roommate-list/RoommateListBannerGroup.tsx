import { Building2, ChevronRight, Sparkles, X } from 'lucide-react';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { ContextualTip } from '@/components/ContextualTip';
import type { TabId, UserProfile } from '@/types/profile';

interface RoommateListBannerGroupProps {
  user: UserProfile;
  isUnassigned: boolean;
  showProfileBanner: boolean;
  onDismissProfileBanner?: () => void;
  onNavigate: (tab: TabId) => void;
  showMatchScoreTip?: boolean;
  onDismissMatchScoreTip?: () => void;
  filteredProfilesCount: number;
}

export function RoommateListBannerGroup({
  user,
  isUnassigned,
  showProfileBanner,
  onDismissProfileBanner,
  onNavigate,
  showMatchScoreTip,
  onDismissMatchScoreTip,
  filteredProfilesCount,
}: RoommateListBannerGroupProps) {
  const { percent: completionPercent, isComplete: profileComplete } = getProfileCompletion(user);

  return (
    <>
      {/* Unassigned Banner */}
      {isUnassigned && (
        <div className="max-w-md mx-auto px-5 pt-5">
          <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl">
            <Building2 className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 mb-1">건물을 먼저 선택해주세요</p>
              <p className="text-xs text-orange-700 leading-relaxed mb-2">
                같은 건물 사용자만 룸메이트 매칭이 가능해요. 건물을 선택하면 맞춤 추천을 받을 수
                있어요.
              </p>
              <button
                onClick={() => onNavigate('profile')}
                className="flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline cursor-pointer"
              >
                배정 건물 등록하기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Completion Banner */}
      {showProfileBanner && !profileComplete && (
        <div className="max-w-md mx-auto px-5 pt-5">
          <div className="relative bg-[var(--knu-primary-light)] border-2 border-[var(--knu-primary)]/20 rounded-2xl p-4">
            <button
              onClick={() => onDismissProfileBanner?.()}
              className="absolute top-3 right-3 p-1 text-[var(--knu-primary)] hover:bg-white/50 rounded-lg transition-colors"
              aria-label="배너 닫기"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <Sparkles className="w-5 h-5 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--knu-primary)] mb-1">
                  프로필 완성도 {completionPercent}%
                </p>
                <p className="text-xs text-[var(--knu-text-secondary)] leading-relaxed mb-2">
                  프로필을 완성하면 더 정확한 매칭을 받을 수 있어요
                </p>
                <button
                  onClick={() => onNavigate('profile')}
                  className="flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
                >
                  프로필 완성하기
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Score Tip + Count */}
      <div className="max-w-md mx-auto px-5 py-5 space-y-3">
        {filteredProfilesCount > 0 && (
          <p className="text-sm text-[var(--knu-text-tertiary)] font-medium">
            {filteredProfilesCount}명의 룸메이트
          </p>
        )}
        {showMatchScoreTip && filteredProfilesCount > 0 && onDismissMatchScoreTip && (
          <ContextualTip
            message="생활패턴이 비슷할수록 매칭점수가 높아요"
            onDismiss={onDismissMatchScoreTip}
          />
        )}
      </div>
    </>
  );
}
