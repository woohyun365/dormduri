import { useState, useCallback, useMemo } from 'react';
import type { BlockedUser, ReportReason } from '@/types/report';

export function useMainSocialState(showToast: (msg: string) => void) {
  // --- Bookmark ---
  const [bookmarkedUserIds, setBookmarkedUserIds] = useState<Set<string>>(new Set());

  const handleToggleBookmark = useCallback((userId: string) => {
    setBookmarkedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  // --- Block ---
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const blockedUserIds = useMemo(() => new Set(blockedUsers.map((u) => u.userId)), [blockedUsers]);

  const handleBlockUser = useCallback(
    (userId: string, nickname: string) => {
      setBlockedUsers((prev) => {
        if (prev.some((u) => u.userId === userId)) return prev;
        return [...prev, { userId, nickname, blockedAt: new Date().toISOString() }];
      });
      setBookmarkedUserIds((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      showToast(`${nickname}님을 차단했어요`);
    },
    [showToast],
  );

  const handleUnblockUser = useCallback(
    (userId: string, nickname: string) => {
      showToast(`${nickname}님의 차단을 해제했어요`);
      setBlockedUsers((prev) => prev.filter((u) => u.userId !== userId));
    },
    [showToast],
  );

  // --- Report ---
  const [reportedUserIds, setReportedUserIds] = useState<Set<string>>(new Set());

  const handleReportUser = useCallback(
    (userId: string, _reason: ReportReason, _detail: string | null) => {
      if (reportedUserIds.has(userId)) {
        showToast('이미 신고한 사용자예요');
        return;
      }
      setReportedUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      showToast('신고가 접수되었어요');
    },
    [reportedUserIds, showToast],
  );

  return {
    bookmarkedUserIds,
    handleToggleBookmark,
    blockedUsers,
    blockedUserIds,
    handleBlockUser,
    handleUnblockUser,
    handleReportUser,
  };
}
