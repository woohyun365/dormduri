'use client';

import { useState, useRef } from 'react';
import { Bookmark, BookmarkCheck, MoreHorizontal } from 'lucide-react';
import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { ProfileDetailBody } from './ProfileDetailBody';
import { buildProfileDetailFooter } from './ProfileDetailFooter';
import { ProfileDetailMoreMenu, ProfileDetailDialogs } from './ProfileDetailModeration';
import type {
  ProfileDetailMatchActionState,
  ProfileDetailMatchScoreType,
} from './model/profileDetailMatchAction';
import type { RoommateProfile } from '@/main/model/profile';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { ReportReason } from '@repo/shared/social-safety/report';

interface ProfileDetailSheetProps {
  profile: RoommateProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestMatch: () => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  hideMatchButton?: boolean;
  matchButtonState?: ProfileDetailMatchActionState;
  onBlock?: (userId: string, nickname: string) => void;
  onReport?: (userId: string, reason: ReportReason, detail: string | null) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  scoreType?: ProfileDetailMatchScoreType;
  userLifestyle?: LifestyleData;
  customFooter?: React.ReactNode;
}

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
  scoreType,
  userLifestyle,
  customFooter,
}: ProfileDetailSheetProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  if (!profile) return null;

  const showActions = !!(onBlock || onReport);

  const handleClose = () => {
    setShowMoreMenu(false);
    onClose();
  };

  const footer =
    customFooter !== undefined
      ? customFooter
      : buildProfileDetailFooter({
          hideMatchButton,
          matchButtonState,
          disabled,
          onDisabledClick,
          onRequestMatch,
        });

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
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[(--knu-background-alt)] transition-colors"
                  aria-label={isBookmarked ? '관심목록에서 제거' : '관심목록에 추가'}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="w-5 h-5 text-[(--knu-primary)]" />
                  ) : (
                    <Bookmark className="w-5 h-5 text-[(--knu-text-tertiary)]" />
                  )}
                </button>
              )}
              {showActions && (
                <button
                  ref={moreButtonRef}
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[(--knu-background-alt)] transition-colors"
                  aria-label="더보기"
                  aria-haspopup="true"
                  aria-expanded={showMoreMenu}
                >
                  <MoreHorizontal className="w-5 h-5 text-[(--knu-text-secondary)]" />
                </button>
              )}
            </div>
          ) : undefined
        }
        footer={footer}
      >
        <ProfileDetailBody profile={profile} scoreType={scoreType} userLifestyle={userLifestyle} />

        {/* More Menu — absolute 위치이므로 BaseBottomSheet 내부 유지 */}
        <ProfileDetailMoreMenu
          isOpen={showMoreMenu}
          onClose={() => setShowMoreMenu(false)}
          onOpenBlockConfirm={() => setShowBlockConfirm(true)}
          onOpenReportSheet={() => setShowReportSheet(true)}
          triggerRef={moreButtonRef}
        />
      </BaseBottomSheet>

      {/* 자체 overlay를 가진 컴포넌트는 BaseBottomSheet 바깥에 렌더 (중첩 focus trap 방지) */}
      <ProfileDetailDialogs
        profile={profile}
        showBlockConfirm={showBlockConfirm}
        onCloseBlockConfirm={() => setShowBlockConfirm(false)}
        showReportSheet={showReportSheet}
        onCloseReportSheet={() => setShowReportSheet(false)}
        onBlock={onBlock}
        onReport={onReport}
        onCloseSheet={handleClose}
      />
    </>
  );
}
