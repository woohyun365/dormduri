'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck, ChevronRight, Lock, MessageCircle } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { LifestyleChipSummary } from './LifestyleChipSummary';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { getMatchButtonStyle } from '@/utils/matchButtonStyle';
import type { RoommateProfile } from '@/types/profile';
import type { MatchScoreType } from '@/utils/matchScore';
import type { MatchButtonState } from '@/types/match';

export type { RoommateProfile } from '@/types/profile';

interface UserCardProps {
  profile: RoommateProfile;
  scoreType?: MatchScoreType;
  onRequestMatch?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  preview?: boolean;
  matchButtonState?: MatchButtonState;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export function UserCard({
  profile,
  scoreType = 'full',
  onRequestMatch,
  onClick,
  disabled,
  onDisabledClick,
  preview = false,
  matchButtonState,
  isBookmarked,
  onToggleBookmark,
}: UserCardProps) {
  const [showPartialTip, setShowPartialTip] = useState(false);
  const dormLabel = getDormitoryLabel(profile.dormitoryId);
  const avatarColor = getAvatarColor(profile.nickname);

  const handleMatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      onDisabledClick?.();
    } else {
      onRequestMatch?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (preview) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 transition-all ${
        preview ? '' : 'hover:shadow-md cursor-pointer'
      }`}
      onClick={preview ? undefined : onClick}
      onKeyDown={preview ? undefined : handleKeyDown}
      role={preview ? undefined : 'button'}
      tabIndex={preview ? undefined : 0}
    >
      {/* Header: avatar + nickname + dorm badge + match score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text}`}
          >
            {profile.nickname.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--knu-text-primary)]">{profile.nickname}</h3>
            {dormLabel && <p className="text-xs text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!preview && onToggleBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              className="w-6 h-6 flex items-center justify-center"
              aria-label={isBookmarked ? '관심목록에서 제거' : '관심목록에 추가'}
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-5 h-5 text-[var(--knu-primary)]" />
              ) : (
                <Bookmark className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
              )}
            </button>
          )}
          {scoreType === 'gated' ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-gray-400 bg-gray-100 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              잠김
            </span>
          ) : (
            <span
              className={`relative px-2.5 py-1 rounded-full text-xs font-bold ${getMatchScoreColor(profile.matchScore)}`}
              onClick={
                scoreType === 'partial'
                  ? (e) => {
                      e.stopPropagation();
                      setShowPartialTip((v) => !v);
                    }
                  : undefined
              }
              onMouseEnter={scoreType === 'partial' ? () => setShowPartialTip(true) : undefined}
              onMouseLeave={scoreType === 'partial' ? () => setShowPartialTip(false) : undefined}
            >
              매칭 {profile.matchScore}%{scoreType === 'partial' && ' (!)'}
              {showPartialTip && scoreType === 'partial' && (
                <span className="absolute top-full right-0 mt-1 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 font-normal">
                  내 기준 호환성입니다. 상대가 조건을 입력하면 정확한 점수를 볼 수 있어요.
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Key lifestyle chips with context icons */}
      <div className="mb-3">
        <LifestyleChipSummary lifestyle={profile.lifestyle} />
      </div>

      {/* Intro (1-line truncate) */}
      <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed line-clamp-1 mb-3">
        {profile.intro}
      </p>

      {/* Message to Roommate */}
      {profile.messageToRoommate && (
        <div className="flex items-center gap-1.5 mb-3 px-3 py-2 bg-blue-50 rounded-xl">
          <MessageCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700 font-medium line-clamp-1">
            {profile.messageToRoommate}
          </p>
        </div>
      )}

      {/* Match request button */}
      {!preview && (
        <div className="flex justify-end">
          {matchButtonState ? (
            (() => {
              const style = getMatchButtonStyle(matchButtonState);
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (style.clickable) onRequestMatch?.();
                  }}
                  disabled={!style.clickable}
                  className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${style.className}`}
                >
                  {style.label}
                  {style.clickable && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })()
          ) : (
            <button
              onClick={handleMatchClick}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                disabled
                  ? 'bg-[var(--knu-primary)] text-white opacity-40 cursor-not-allowed'
                  : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              }`}
            >
              매칭 요청
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
