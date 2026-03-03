'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck, ChevronRight, MessageCircle, MoreHorizontal } from 'lucide-react';
import { LIFESTYLE_FIELD_NAMES, getLifestyleLabel } from '@/constants/lifestyle';
import {
  ADDITIONAL_FIELD_NAMES,
  GRADES,
  TEMPERATURE_SENSITIVITY,
} from '@/constants/additional-profile';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProfileMoreMenu } from './ProfileMoreMenu';
import { ReportSheet } from './ReportSheet';
import { CompatibilityReport } from './CompatibilityReport';
import { getMatchButtonStyle } from '@/utils/matchButtonStyle';
import type { RoommateProfile } from '@/types/profile';
import type { LifestyleData } from '@/types/lifestyle';
import type { ReportReason } from '@/types/report';
import type { MatchButtonState } from '@/types/match';

interface ProfileDetailSheetProps {
  profile: RoommateProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestMatch: () => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  hideMatchButton?: boolean;
  matchButtonState?: MatchButtonState;
  onBlock?: (userId: string, nickname: string) => void;
  onReport?: (userId: string, reason: ReportReason, detail: string | null) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  userLifestyle?: LifestyleData;
  customFooter?: React.ReactNode;
}

const LIFESTYLE_FIELDS = Object.keys(LIFESTYLE_FIELD_NAMES) as (keyof LifestyleData)[];

export function ProfileDetailSheet({
  profile,
  isOpen,
  onClose,
  onRequestMatch,
  disabled,
  onDisabledClick,
  hideMatchButton,
  matchButtonState,
  onBlock,
  onReport,
  isBookmarked,
  onToggleBookmark,
  userLifestyle,
  customFooter,
}: ProfileDetailSheetProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  if (!profile) return null;

  const dormLabel = getDormitoryLabel(profile.dormitoryId);
  const avatarColor = getAvatarColor(profile.nickname);

  const handleMatchClick = () => {
    if (disabled) {
      onDisabledClick?.();
    } else {
      onRequestMatch();
    }
  };

  const showActions = !!(onBlock || onReport);

  const handleClose = () => {
    setShowMoreMenu(false);
    onClose();
  };

  return (
    <>
      <BaseBottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="프로필"
        headerRight={
          onToggleBookmark || showActions ? (
            <div className="flex items-center gap-1">
              {onToggleBookmark && (
                <button
                  onClick={onToggleBookmark}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--knu-background-alt)] transition-colors"
                  aria-label={isBookmarked ? '관심목록에서 제거' : '관심목록에 추가'}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="w-5 h-5 text-[var(--knu-primary)]" />
                  ) : (
                    <Bookmark className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                  )}
                </button>
              )}
              {showActions && (
                <button
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--knu-background-alt)] transition-colors"
                  aria-label="더보기"
                  aria-haspopup="menu"
                  aria-expanded={showMoreMenu}
                >
                  <MoreHorizontal className="w-5 h-5 text-[var(--knu-text-secondary)]" />
                </button>
              )}
            </div>
          ) : undefined
        }
        footer={
          customFooter !== undefined ? (
            customFooter
          ) : !hideMatchButton ? (
            matchButtonState ? (
              (() => {
                const style = getMatchButtonStyle(matchButtonState);
                return (
                  <button
                    onClick={() => {
                      if (style.clickable) onRequestMatch();
                    }}
                    disabled={!style.clickable}
                    className={`w-full flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-base font-semibold transition-colors ${style.className}`}
                  >
                    {style.label}
                    {style.clickable && <ChevronRight className="w-5 h-5" />}
                  </button>
                );
              })()
            ) : (
              <button
                onClick={handleMatchClick}
                className={`w-full flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                  disabled
                    ? 'bg-[var(--knu-primary)] text-white opacity-40 cursor-not-allowed'
                    : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
                }`}
              >
                매칭 요청
                <ChevronRight className="w-5 h-5" />
              </button>
            )
          ) : undefined
        }
      >
        <div className="p-5 pb-5 space-y-5">
          {/* Avatar + Nickname + Dorm + Match */}
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 ${avatarColor.bg} rounded-full flex items-center justify-center text-2xl font-bold ${avatarColor.text}`}
            >
              {profile.nickname.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">
                {profile.nickname}
              </h3>
              {dormLabel && <p className="text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-bold ${getMatchScoreColor(profile.matchScore)}`}
            >
              매칭 {profile.matchScore}%
            </span>
          </div>

          {/* Lifestyle Grid */}
          <div className="bg-[var(--knu-background-alt)] rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3">
              {LIFESTYLE_FIELDS.map((field) => (
                <div key={field}>
                  <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                    {LIFESTYLE_FIELD_NAMES[field]}
                  </p>
                  <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                    {getLifestyleLabel(field, profile.lifestyle[field])}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Compatibility Report */}
          {userLifestyle && (
            <CompatibilityReport
              userLifestyle={userLifestyle}
              profileLifestyle={profile.lifestyle}
            />
          )}

          {/* Additional Info */}
          {(profile.additional.college ||
            profile.additional.grade ||
            profile.additional.mbti ||
            profile.additional.temperatureSensitivity) && (
            <div className="bg-[var(--knu-background-alt)] rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-3">
                {profile.additional.college && (
                  <div>
                    <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                      {ADDITIONAL_FIELD_NAMES.college}
                    </p>
                    <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                      {profile.additional.college}
                    </p>
                  </div>
                )}
                {profile.additional.grade && (
                  <div>
                    <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                      {ADDITIONAL_FIELD_NAMES.grade}
                    </p>
                    <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                      {GRADES.find((g) => g.value === profile.additional.grade)?.label ??
                        profile.additional.grade}
                    </p>
                  </div>
                )}
                {profile.additional.mbti && (
                  <div>
                    <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                      {ADDITIONAL_FIELD_NAMES.mbti}
                    </p>
                    <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                      {profile.additional.mbti}
                    </p>
                  </div>
                )}
                {profile.additional.temperatureSensitivity && (
                  <div>
                    <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                      {ADDITIONAL_FIELD_NAMES.temperatureSensitivity}
                    </p>
                    <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                      {
                        TEMPERATURE_SENSITIVITY.find(
                          (t) => t.value === profile.additional.temperatureSensitivity,
                        )?.label
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intro */}
          <div>
            <p className="text-xs text-[var(--knu-text-tertiary)] mb-1.5">자기소개</p>
            <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed">
              {profile.intro}
            </p>
          </div>

          {/* Message to Roommate */}
          {profile.messageToRoommate && (
            <div className="bg-blue-50 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-semibold text-blue-700">룸메에게 한마디</p>
              </div>
              <p className="text-sm text-blue-800 leading-relaxed">{profile.messageToRoommate}</p>
            </div>
          )}
        </div>

        {/* More Menu — absolute 위치이므로 BaseBottomSheet 내부 유지 */}
        <ProfileMoreMenu
          isOpen={showMoreMenu}
          onClose={() => setShowMoreMenu(false)}
          onBlock={() => setShowBlockConfirm(true)}
          onReport={() => setShowReportSheet(true)}
        />
      </BaseBottomSheet>

      {/* 자체 overlay를 가진 컴포넌트는 BaseBottomSheet 바깥에 렌더 (중첩 focus trap 방지) */}

      {/* Block Confirm Dialog */}
      <ConfirmDialog
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={() => {
          onBlock?.(profile.id, profile.nickname);
          handleClose();
        }}
        title="사용자 차단"
        message={`${profile.nickname}님을 차단하시겠습니까?\n\n차단하면 해당 사용자가 목록에서 제거됩니다.`}
        confirmLabel="차단하기"
        variant="danger"
      />

      {/* Report Sheet */}
      <ReportSheet
        isOpen={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        onSubmit={(reason, detail) => {
          onReport?.(profile.id, reason, detail);
          setShowReportSheet(false);
          handleClose();
        }}
      />
    </>
  );
}
