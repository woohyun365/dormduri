'use client';

import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { EmptyState } from '@/main/components/feedback/EmptyState';
import { getAvatarColor } from '@/utils/avatarColor';
import { Ban } from 'lucide-react';
import type { BlockedUser } from '@/types/report';

interface BlockManageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  blockedUsers: BlockedUser[];
  onUnblock: (userId: string, nickname: string) => void;
}

export function BlockManageSheet({
  isOpen,
  onClose,
  blockedUsers,
  onUnblock,
}: BlockManageSheetProps) {
  return (
    <BaseBottomSheet isOpen={isOpen} onClose={onClose} title="차단 관리">
      <div className="p-5">
        {blockedUsers.length === 0 ? (
          <EmptyState
            icon={<Ban className="w-8 h-8 text-(--knu-text-tertiary)" />}
            message="차단한 사용자가 없어요"
          />
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((user) => {
              const avatarColor = getAvatarColor(user.nickname);
              return (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-3.5 bg-(--knu-background-alt) rounded-xl"
                >
                  <div
                    className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-base font-bold ${avatarColor.text}`}
                  >
                    {user.nickname.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-(--knu-text-primary)">
                      {user.nickname}
                    </p>
                    <p className="text-xs text-(--knu-text-tertiary)">
                      {new Date(user.blockedAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <button
                    onClick={() => onUnblock(user.userId, user.nickname)}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    해제
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseBottomSheet>
  );
}
